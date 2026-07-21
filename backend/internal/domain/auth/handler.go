package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/user"
	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db        *pgxpool.Pool
	userRepo  *user.Repository
	cfg       *config.Config
	mail      infra.Mailer
	tokens    *TokenService
	rl        *RateLimiter
	email     *EmailTokenStore
	refresh   *RefreshStore
	blacklist *JWTBlacklist
	pending   *PendingRegistrationStore
}

func NewAuthHandlerWithDeps(
	db *pgxpool.Pool,
	cfg *config.Config,
	m infra.Mailer,
	tokens *TokenService,
	rl *RateLimiter,
	email *EmailTokenStore,
	refresh *RefreshStore,
	blacklist *JWTBlacklist,
	pending *PendingRegistrationStore,
	userRepo *user.Repository,
) *AuthHandler {
	return &AuthHandler{
		db: db, cfg: cfg, mail: m,
		tokens: tokens, rl: rl, email: email,
		refresh: refresh, blacklist: blacklist,
		pending: pending, userRepo: userRepo,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}
	if req.Password != req.PasswordConfirm {
		infra.ApiError(c, http.StatusBadRequest, "PASSWORD_MISMATCH", "两次密码不一致")
		return
	}

	if !isValidAccountID(req.AccountID) {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_ACCOUNT_ID", "账号 ID 只能包含字母、数字和下划线")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	ok, err := h.rl.Allow(ctx, "rl:register:ip:"+c.ClientIP(), 3, time.Hour)
	if err != nil {
		log.Printf("rate limit error: register ip=%s err=%v", c.ClientIP(), err)
		infra.ApiError(c, http.StatusInternalServerError, "RATE_LIMIT_ERROR", "限流检查失败")
		return
	}
	if !ok {
		log.Printf("rate limit hit: register ip=%s", c.ClientIP())
		infra.ApiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "注册过于频繁，请稍后再试")
		return
	}

	var existing int
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE account_id = $1`, req.AccountID).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		infra.ApiError(c, http.StatusConflict, "ACCOUNT_ID_TAKEN", "账号 ID 已被使用")
		return
	}
	existing = 0
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE email = $1`, req.Email).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		infra.ApiError(c, http.StatusConflict, "EMAIL_TAKEN", "邮箱已被注册")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "密码处理失败")
		return
	}

	data, err := json.Marshal(PendingRegistration{
		AccountID: req.AccountID,
		Username:  req.Username,
		Password:  string(hash),
		Email:     req.Email,
	})
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "数据处理失败")
		return
	}

	token, err := RandomToken()
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
		return
	}

	if err := h.pending.Set(ctx, token, data); err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "注册暂存失败")
		return
	}

	link := fmt.Sprintf("%s/verify-email?token=%s", strings.TrimRight(h.cfg.AppPublicURL, "/"), token)
	subject := "Oxelia51 邮箱验证"
	body := fmt.Sprintf("请点击以下链接验证邮箱（24小时内有效）：\n%s\n", link)
	if err := h.mail.Send(ctx, req.Email, subject, body); err != nil {
		_ = h.pending.Delete(ctx, token)
		infra.ApiError(c, http.StatusInternalServerError, "MAIL_ERROR", "验证邮件发送失败")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":         "verification_email_sent",
		"smtp_configured": h.cfg.SMTPConfigured(),
	})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		infra.ApiError(c, http.StatusBadRequest, "TOKEN_INVALID", "缺少验证令牌")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	raw, err := h.pending.Get(ctx, token)
	if err != nil || len(raw) == 0 {
		infra.ApiError(c, http.StatusBadRequest, "TOKEN_INVALID", "验证链接无效或已过期，请重新注册")
		return
	}

	var pending PendingRegistration
	if err := json.Unmarshal(raw, &pending); err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "数据解析失败")
		return
	}

	var existing int
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE account_id = $1`, pending.AccountID).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		_ = h.pending.Delete(ctx, token)
		infra.ApiError(c, http.StatusConflict, "ACCOUNT_ID_TAKEN", "账号 ID 已被使用，请重新注册")
		return
	}
	existing = 0
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE email = $1`, pending.Email).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		_ = h.pending.Delete(ctx, token)
		infra.ApiError(c, http.StatusConflict, "EMAIL_TAKEN", "邮箱已被注册，请重新注册")
		return
	}

	var userID int64
	err = h.db.QueryRow(ctx,
		`INSERT INTO users (account_id, username, password, email, email_verified)
		 VALUES ($1, $2, $3, $4, TRUE)
		 RETURNING id`,
		pending.AccountID, pending.Username, pending.Password, pending.Email,
	).Scan(&userID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			_ = h.pending.Delete(ctx, token)
			infra.ApiError(c, http.StatusConflict, "DUPLICATE", "注册信息冲突，请重新注册")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "创建用户失败")
		return
	}

	_ = h.pending.Delete(ctx, token)

	c.JSON(http.StatusOK, gin.H{"message": "email_verified"})
}

func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	ok, err := h.rl.Allow(ctx, "rl:resend:email:"+req.Email, 1, 24*time.Hour)
	if err != nil || !ok {
		if !ok {
			log.Printf("rate limit hit: resend email=%s", req.Email)
			infra.ApiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "发送过于频繁")
			return
		}
		log.Printf("rate limit error: resend email=%s err=%v", req.Email, err)
		infra.ApiError(c, http.StatusInternalServerError, "RATE_LIMIT_ERROR", "限流检查失败")
		return
	}

	keys, scanErr := h.pending.ScanKeys(ctx, 100)
	if scanErr != nil {
		log.Printf("resend: scan pending keys error: %v", scanErr)
	}
	var foundData []byte
	var foundToken string
	for _, key := range keys {
		raw, getErr := h.pending.GetByKey(ctx, key)
		if getErr != nil {
			continue
		}
		var p PendingRegistration
		if json.Unmarshal(raw, &p) != nil {
			continue
		}
		if strings.EqualFold(p.Email, req.Email) {
			foundData = raw
			foundToken = strings.TrimPrefix(key, "pending_reg:")
			break
		}
	}

	if foundData != nil {
		_ = h.pending.Delete(ctx, foundToken)
		newToken, err := RandomToken()
		if err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
			return
		}
		if err := h.pending.Set(ctx, newToken, foundData); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "注册暂存失败")
			return
		}
		link := fmt.Sprintf("%s/verify-email?token=%s", strings.TrimRight(h.cfg.AppPublicURL, "/"), newToken)
		subject := "Oxelia51 邮箱验证"
		body := fmt.Sprintf("请点击以下链接验证邮箱（24小时内有效）：\n%s\n", link)
		if err := h.mail.Send(ctx, req.Email, subject, body); err != nil {
			_ = h.pending.Delete(ctx, newToken)
			infra.ApiError(c, http.StatusInternalServerError, "MAIL_ERROR", "验证邮件发送失败")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	var userID int64
	var verified bool
	err = h.db.QueryRow(ctx,
		`SELECT id, email_verified FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &verified)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if verified {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	if err := h.sendVerificationEmail(ctx, userID, req.Email); err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "MAIL_ERROR", "邮件发送失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
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
		h.recordLoginFailure(ctx, c.ClientIP())
		infra.ApiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "账号或密码错误")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		h.recordLoginFailure(ctx, c.ClientIP())
		infra.ApiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "账号或密码错误")
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

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	ok, _ := h.rl.Allow(ctx, "rl:forgot:email:"+req.Email, 1, 24*time.Hour)
	if !ok {
		log.Printf("rate limit hit: forgot email=%s", req.Email)
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	var userID int64
	err := h.db.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, req.Email).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	token, err := RandomToken()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}
	if err := h.email.Set(ctx, "reset_password", token, fmt.Sprintf("%d", userID)); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	link := fmt.Sprintf("%s/reset-password?token=%s", strings.TrimRight(h.cfg.AppPublicURL, "/"), token)
	subject := "Oxelia51 重置密码"
	body := fmt.Sprintf("请点击以下链接重置密码（24小时内有效）：\n%s\n", link)
	_ = h.mail.Send(ctx, req.Email, subject, body)

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}
	if req.Password != req.PasswordConfirm {
		infra.ApiError(c, http.StatusBadRequest, "PASSWORD_MISMATCH", "两次密码不一致")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, err := h.email.Get(ctx, "reset_password", req.Token)
	if err != nil {
		infra.ApiError(c, http.StatusBadRequest, "TOKEN_INVALID", "重置链接无效或已过期")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "密码处理失败")
		return
	}

	_, err = h.db.Exec(ctx,
		`UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
		string(hash), userID,
	)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "重置失败")
		return
	}
	_ = h.email.Delete(ctx, "reset_password", req.Token)

	c.JSON(http.StatusOK, gin.H{"message": "password_reset"})
}

func (h *AuthHandler) sendVerificationEmail(ctx context.Context, userID int64, email string) error {
	token, err := RandomToken()
	if err != nil {
		return err
	}
	if err := h.email.Set(ctx, "verify", token, fmt.Sprintf("%d", userID)); err != nil {
		return err
	}
	link := fmt.Sprintf("%s/verify-email?token=%s", strings.TrimRight(h.cfg.AppPublicURL, "/"), token)
	subject := "Oxelia51 邮箱验证"
	body := fmt.Sprintf("请点击以下链接验证邮箱（24小时内有效）：\n%s\n", link)
	return h.mail.Send(ctx, email, subject, body)
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

var accountIDRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func isValidAccountID(s string) bool {
	return accountIDRegex.MatchString(s)
}
