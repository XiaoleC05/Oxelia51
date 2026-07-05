package handler

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/auth"
	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/mailer"
	"github.com/XiaoleC05/oxelia51-backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthHandler struct {
	db     *pgxpool.Pool
	cfg    *config.Config
	mail   mailer.Mailer
	tokens *auth.TokenService
	rl     *auth.RateLimiter
	email  *auth.EmailTokenStore
	refresh *auth.RefreshStore
	blacklist *auth.JWTBlacklist
}

func NewAuthHandlerWithDeps(
	db *pgxpool.Pool,
	cfg *config.Config,
	m mailer.Mailer,
	tokens *auth.TokenService,
	rl *auth.RateLimiter,
	email *auth.EmailTokenStore,
	refresh *auth.RefreshStore,
	blacklist *auth.JWTBlacklist,
) *AuthHandler {
	return &AuthHandler{
		db: db, cfg: cfg, mail: m,
		tokens: tokens, rl: rl, email: email,
		refresh: refresh, blacklist: blacklist,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}
	if req.Password != req.PasswordConfirm {
		apiError(c, http.StatusBadRequest, "PASSWORD_MISMATCH", "两次密码不一致")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	ok, err := h.rl.Allow(ctx, "rl:register:ip:"+c.ClientIP(), 3, time.Hour)
	if err != nil {
		log.Printf("rate limit error: register ip=%s err=%v", c.ClientIP(), err)
		apiError(c, http.StatusInternalServerError, "RATE_LIMIT_ERROR", "限流检查失败")
		return
	}
	if !ok {
		log.Printf("rate limit hit: register ip=%s", c.ClientIP())
		apiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "注册过于频繁，请稍后再试")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "密码处理失败")
		return
	}

	var userID int64
	err = h.db.QueryRow(ctx,
		`INSERT INTO users (username, password, email, email_verified)
		 VALUES ($1, $2, $3, FALSE)
		 RETURNING id`,
		req.Username, string(hash), req.Email,
	).Scan(&userID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "email") {
				apiError(c, http.StatusConflict, "EMAIL_TAKEN", "邮箱已被注册")
				return
			}
			apiError(c, http.StatusConflict, "USERNAME_TAKEN", "用户名已被注册")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "注册失败")
		return
	}

	if err := h.sendVerificationEmail(ctx, userID, req.Email); err != nil {
		apiError(c, http.StatusInternalServerError, "MAIL_ERROR", "验证邮件发送失败")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "verification_email_sent"})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		apiError(c, http.StatusBadRequest, "TOKEN_INVALID", "缺少验证令牌")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, err := h.email.Get(ctx, "verify", token)
	if err != nil {
		apiError(c, http.StatusBadRequest, "TOKEN_INVALID", "验证链接无效")
		return
	}

	_, err = h.db.Exec(ctx,
		`UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`,
		userID,
	)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "验证失败")
		return
	}
	_ = h.email.Delete(ctx, "verify", token)

	c.JSON(http.StatusOK, gin.H{"message": "email_verified"})
}

func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req model.ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	ok, err := h.rl.Allow(ctx, "rl:resend:email:"+req.Email, 1, 24*time.Hour)
	if err != nil || !ok {
		if !ok {
			log.Printf("rate limit hit: resend email=%s", req.Email)
			apiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "发送过于频繁")
			return
		}
		log.Printf("rate limit error: resend email=%s err=%v", req.Email, err)
		apiError(c, http.StatusInternalServerError, "RATE_LIMIT_ERROR", "限流检查失败")
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
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if verified {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	if err := h.sendVerificationEmail(ctx, userID, req.Email); err != nil {
		apiError(c, http.StatusInternalServerError, "MAIL_ERROR", "邮件发送失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rlKey := "rl:login:ip:" + c.ClientIP()
	count, err := h.rl.Count(ctx, rlKey)
	if err != nil {
		// R5 修复：不再静默 Count 错误，记录日志后继续走凭证校验（fail-open，避免 Redis 故障阻断登录）
		log.Printf("rate limit count error: login ip=%s err=%v", c.ClientIP(), err)
	} else if count >= 10 {
		log.Printf("rate limit hit: login ip=%s count=%d", c.ClientIP(), count)
		apiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "登录尝试过多，请稍后再试")
		return
	}

	user, err := h.fetchUserByUsername(ctx, req.Username)
	if err != nil {
		h.recordLoginFailure(ctx, c.ClientIP())
		apiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "用户名或密码错误")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		h.recordLoginFailure(ctx, c.ClientIP())
		apiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "用户名或密码错误")
		return
	}

	if !user.EmailVerified {
		apiError(c, http.StatusForbidden, "EMAIL_NOT_VERIFIED", "请先验证邮箱后再登录")
		return
	}

	pair, err := h.issueTokenPair(ctx, user)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":         pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

func (h *AuthHandler) recordLoginFailure(ctx context.Context, ip string) {
	_, _ = h.rl.Allow(ctx, "rl:login:ip:"+ip, 10, 15*time.Minute)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req model.LogoutRequest
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
	var req model.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, err := h.refresh.Get(ctx, req.RefreshToken)
	if err != nil {
		apiError(c, http.StatusUnauthorized, "INVALID_REFRESH", "刷新令牌无效")
		return
	}

	user, err := h.fetchUserByID(ctx, userID)
	if err != nil {
		apiError(c, http.StatusUnauthorized, "INVALID_REFRESH", "用户不存在")
		return
	}

	_ = h.refresh.Delete(ctx, req.RefreshToken)
	pair, err := h.issueTokenPair(ctx, user)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":         pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
	})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req model.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
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

	token, err := auth.RandomToken()
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
	var req model.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}
	if req.Password != req.PasswordConfirm {
		apiError(c, http.StatusBadRequest, "PASSWORD_MISMATCH", "两次密码不一致")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, err := h.email.Get(ctx, "reset_password", req.Token)
	if err != nil {
		apiError(c, http.StatusBadRequest, "TOKEN_INVALID", "重置链接无效或已过期")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "密码处理失败")
		return
	}

	_, err = h.db.Exec(ctx,
		`UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
		string(hash), userID,
	)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "重置失败")
		return
	}
	_ = h.email.Delete(ctx, "reset_password", req.Token)

	c.JSON(http.StatusOK, gin.H{"message": "password_reset"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetInt64("userID")
	if userID == 0 {
		apiError(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	user, err := h.fetchUserByID(ctx, fmt.Sprintf("%d", userID))
	if err != nil {
		apiError(c, http.StatusNotFound, "NOT_FOUND", "用户不存在")
		return
	}
	user.Password = ""
	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) sendVerificationEmail(ctx context.Context, userID int64, email string) error {
	token, err := auth.RandomToken()
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

func (h *AuthHandler) issueTokenPair(ctx context.Context, user model.User) (auth.TokenPair, error) {
	access, _, _, err := h.tokens.IssueAccess(user)
	if err != nil {
		return auth.TokenPair{}, err
	}
	refresh, err := h.tokens.IssueRefresh()
	if err != nil {
		return auth.TokenPair{}, err
	}
	if err := h.refresh.Set(ctx, refresh, fmt.Sprintf("%d", user.ID)); err != nil {
		return auth.TokenPair{}, err
	}
	return auth.TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(h.cfg.AccessTokenTTL.Seconds()),
	}, nil
}

func (h *AuthHandler) fetchUserByUsername(ctx context.Context, username string) (model.User, error) {
	var u model.User
	err := h.db.QueryRow(ctx,
		`SELECT id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE username = $1`, username,
	).Scan(&u.ID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (h *AuthHandler) fetchUserByID(ctx context.Context, id string) (model.User, error) {
	var u model.User
	err := h.db.QueryRow(ctx,
		`SELECT id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}
