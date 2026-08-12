package auth

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/user"
	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// dummyBcryptHash 防登录时序枚举的固定 dummy hash（bcrypt DefaultCost，与真实密码哈希同成本）。
// 仅用于账户不存在时的占位比对（见 Login），不是任何真实账户的哈希。
var dummyBcryptHash = []byte("$2a$10$CGkSVUGvBSObpyJ4sTsBj.XKa5gm1IjI2sK98mIJL9gaCybzBONCW")

type AuthHandler struct {
	db        *pgxpool.Pool
	userRepo  *user.Repository
	cfg       *config.Config
	tokens    *TokenService
	rl        *RateLimiter
	refresh   *RefreshStore
	blacklist *JWTBlacklist
}

func NewAuthHandlerWithDeps(
	db *pgxpool.Pool,
	cfg *config.Config,
	tokens *TokenService,
	rl *RateLimiter,
	refresh *RefreshStore,
	blacklist *JWTBlacklist,
	userRepo *user.Repository,
) *AuthHandler {
	return &AuthHandler{
		db: db, cfg: cfg,
		tokens: tokens, rl: rl,
		refresh: refresh, blacklist: blacklist,
		userRepo: userRepo,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rlKey := "rl:login:ip:" + c.ClientIP()
	count, err := h.rl.Count(ctx, rlKey)
	if err != nil {
		log.Printf("rate limit count error: login ip=%s err=%v", c.ClientIP(), err)
	} else if count >= 10 {
		log.Printf("rate limit hit: login ip=%s count=%d", c.ClientIP(), count)
		infra.ApiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "登录尝试过多，请稍后再试")
		return
	}

	var u user.User
	if strings.Contains(req.Account, "@") {
		u, err = h.userRepo.FetchByEmail(ctx, req.Account)
	} else {
		u, err = h.userRepo.FetchByAccountID(ctx, req.Account)
	}
	if err != nil {
		// 防时序枚举：账户不存在时也做一次 dummy bcrypt 比对拉平耗时，
		// 否则「是否执行 bcrypt」的 50-100ms 时差会泄露账户是否存在。
		// 比较结果丢弃，仅用于均衡响应时间。
		_ = bcrypt.CompareHashAndPassword(dummyBcryptHash, []byte(req.Password))
		h.recordLoginFailure(ctx, c.ClientIP())
		infra.ApiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "账户或密码不正确")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		h.recordLoginFailure(ctx, c.ClientIP())
		infra.ApiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "账户或密码不正确")
		return
	}

	if !u.EmailVerified {
		infra.ApiError(c, http.StatusForbidden, "EMAIL_NOT_VERIFIED", "请先验证邮箱后再登录")
		return
	}

	pair, err := h.issueTokenPair(ctx, u)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":         pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user": gin.H{
			"id":         u.ID,
			"account_id": u.AccountID,
			"username":   u.Username,
			"email":      u.Email,
			"role":       u.Role,
		},
	})
}

func (h *AuthHandler) recordLoginFailure(ctx context.Context, ip string) {
	_, _ = h.rl.Allow(ctx, "rl:login:ip:"+ip, 10, 15*time.Minute)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req LogoutRequest
	_ = c.ShouldBindJSON(&req)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	jti, _ := c.Get("jti")
	expVal, _ := c.Get("tokenExp")
	jtiStr, _ := jti.(string)
	expUnix, _ := expVal.(float64)
	if jtiStr != "" && expUnix > 0 {
		ttl := time.Until(time.Unix(int64(expUnix), 0))
		if ttl > 0 {
			_ = h.blacklist.Add(ctx, jtiStr, ttl)
		}
	}

	if req.RefreshToken != "" {
		_ = h.refresh.Delete(ctx, req.RefreshToken)
	}

	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, err := h.refresh.Get(ctx, req.RefreshToken)
	if err != nil {
		infra.ApiError(c, http.StatusUnauthorized, "INVALID_REFRESH", "刷新令牌无效")
		return
	}

	u, err := h.userRepo.FetchByID(ctx, userID)
	if err != nil {
		infra.ApiError(c, http.StatusUnauthorized, "INVALID_REFRESH", "用户不存在")
		return
	}

	_ = h.refresh.Delete(ctx, req.RefreshToken)
	pair, err := h.issueTokenPair(ctx, u)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":         pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
	})
}

func (h *AuthHandler) issueTokenPair(ctx context.Context, u user.User) (TokenPair, error) {
	access, _, _, err := h.tokens.IssueAccess(u)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := h.tokens.IssueRefresh()
	if err != nil {
		return TokenPair{}, err
	}
	if err := h.refresh.Set(ctx, refresh, fmt.Sprintf("%d", u.ID)); err != nil {
		return TokenPair{}, err
	}
	return TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(h.cfg.AccessTokenTTL.Seconds()),
	}, nil
}
