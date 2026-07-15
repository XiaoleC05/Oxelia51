package handler

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
	db        *pgxpool.Pool
	cfg       *config.Config
	mail      mailer.Mailer
	tokens    *auth.TokenService
	rl        *auth.RateLimiter
	email     *auth.EmailTokenStore
	refresh   *auth.RefreshStore
	blacklist *auth.JWTBlacklist
	pending   *auth.PendingRegistrationStore
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
	pending *auth.PendingRegistrationStore,
) *AuthHandler {
	return &AuthHandler{
		db: db, cfg: cfg, mail: m,
		tokens: tokens, rl: rl, email: email,
		refresh: refresh, blacklist: blacklist,
		pending: pending,
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

	if !isValidAccountID(req.AccountID) {
		apiError(c, http.StatusBadRequest, "INVALID_ACCOUNT_ID", "账号 ID 只能包含字母、数字和下划线")
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

	// Check for existing account_id and email BEFORE creating anything
	var existing int
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE account_id = $1`, req.AccountID).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		apiError(c, http.StatusConflict, "ACCOUNT_ID_TAKEN", "账号 ID 已被使用")
		return
	}
	existing = 0
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE email = $1`, req.Email).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		apiError(c, http.StatusConflict, "EMAIL_TAKEN", "邮箱已被注册")
		return
	}

	// Hash password and store pending registration in Redis
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "密码处理失败")
		return
	}

	data, err := json.Marshal(model.PendingRegistration{
		AccountID: req.AccountID,
		Username:  req.Username,
		Password:  string(hash),
		Email:     req.Email,
	})
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "数据处理失败")
		return
	}

	// Generate verification token and link to pending data
	token, err := auth.RandomToken()
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
		return
	}

	if err := h.pending.Set(ctx, token, data); err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "注册暂存失败")
		return
	}

	// Send verification email
	link := fmt.Sprintf("%s/verify-email?token=%s", strings.TrimRight(h.cfg.AppPublicURL, "/"), token)
	subject := "Oxelia51 邮箱验证"
	body := fmt.Sprintf("请点击以下链接验证邮箱（24小时内有效）：\n%s\n", link)
	if err := h.mail.Send(ctx, req.Email, subject, body); err != nil {
		_ = h.pending.Delete(ctx, token)
		apiError(c, http.StatusInternalServerError, "MAIL_ERROR", "验证邮件发送失败")
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
		apiError(c, http.StatusBadRequest, "TOKEN_INVALID", "缺少验证令牌")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get pending registration data from Redis
	raw, err := h.pending.Get(ctx, token)
	if err != nil || len(raw) == 0 {
		apiError(c, http.StatusBadRequest, "TOKEN_INVALID", "验证链接无效或已过期，请重新注册")
		return
	}

	var pending model.PendingRegistration
	if err := json.Unmarshal(raw, &pending); err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "数据解析失败")
		return
	}

	// Double-check no race condition: account_id/email still available?
	var existing int
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE account_id = $1`, pending.AccountID).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		_ = h.pending.Delete(ctx, token)
		apiError(c, http.StatusConflict, "ACCOUNT_ID_TAKEN", "账号 ID 已被使用，请重新注册")
		return
	}
	existing = 0
	err = h.db.QueryRow(ctx, `SELECT 1 FROM users WHERE email = $1`, pending.Email).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if existing == 1 {
		_ = h.pending.Delete(ctx, token)
		apiError(c, http.StatusConflict, "EMAIL_TAKEN", "邮箱已被注册，请重新注册")
		return
	}

	// Create user in DB with email_verified = TRUE
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
			apiError(c, http.StatusConflict, "DUPLICATE", "注册信息冲突，请重新注册")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "创建用户失败")
		return
	}

	// Clean up pending data
	_ = h.pending.Delete(ctx, token)

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

	// 1. 先从 Redis pending 中查找匹配 email 的待注册数据
	// （新用户尚未写入 DB，只能从 pending 暂存中查找）
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
		var p model.PendingRegistration
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
		// 删除旧 token，生成新 token，覆盖旧验证链接
		_ = h.pending.Delete(ctx, foundToken)
		newToken, err := auth.RandomToken()
		if err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "令牌生成失败")
			return
		}
		if err := h.pending.Set(ctx, newToken, foundData); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "注册暂存失败")
			return
		}
		link := fmt.Sprintf("%s/verify-email?token=%s", strings.TrimRight(h.cfg.AppPublicURL, "/"), newToken)
		subject := "Oxelia51 邮箱验证"
		body := fmt.Sprintf("请点击以下链接验证邮箱（24小时内有效）：\n%s\n", link)
		if err := h.mail.Send(ctx, req.Email, subject, body); err != nil {
			_ = h.pending.Delete(ctx, newToken)
			apiError(c, http.StatusInternalServerError, "MAIL_ERROR", "验证邮件发送失败")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}

	// 2. 回退到查 DB（兼容旧流程：已入库但未验证的用户）
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
		log.Printf("rate limit count error: login ip=%s err=%v", c.ClientIP(), err)
	} else if count >= 10 {
		log.Printf("rate limit hit: login ip=%s count=%d", c.ClientIP(), count)
		apiError(c, http.StatusTooManyRequests, "RATE_LIMITED", "登录尝试过多，请稍后再试")
		return
	}

	// 判断是 email 还是 account_id
	var user model.User
	if strings.Contains(req.Account, "@") {
		user, err = h.fetchUserByEmail(ctx, req.Account)
	} else {
		user, err = h.fetchUserByAccountID(ctx, req.Account)
	}
	if err != nil {
		h.recordLoginFailure(ctx, c.ClientIP())
		apiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "账号或密码错误")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		h.recordLoginFailure(ctx, c.ClientIP())
		apiError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "账号或密码错误")
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
			"id":         user.ID,
			"account_id": user.AccountID,
			"username":   user.Username,
			"email":      user.Email,
			"role":       user.Role,
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

// PatchProfile PATCH /api/auth/profile — 允许用户修改自己的 username（显示名）
func (h *AuthHandler) PatchProfile(c *gin.Context) {
	userID := c.GetInt64("userID")
	if userID == 0 {
		apiError(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}

	var req model.PatchProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	if req.Username == nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "至少提供一个要修改的字段")
		return
	}
	if strings.TrimSpace(*req.Username) == "" {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "用户名不能为空")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var updated model.User
	err := h.db.QueryRow(ctx,
		`UPDATE users SET username = COALESCE($2, username), updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, account_id, username, password, email, role, email_verified, created_at, updated_at`,
		userID, req.Username,
	).Scan(
		&updated.ID, &updated.AccountID, &updated.Username, &updated.Password,
		&updated.Email, &updated.Role, &updated.EmailVerified,
		&updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}
	updated.Password = ""
	c.JSON(http.StatusOK, updated)
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

func (h *AuthHandler) fetchUserByAccountID(ctx context.Context, accountID string) (model.User, error) {
	var u model.User
	err := h.db.QueryRow(ctx,
		`SELECT id, account_id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE account_id = $1`, accountID,
	).Scan(&u.ID, &u.AccountID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (h *AuthHandler) fetchUserByEmail(ctx context.Context, email string) (model.User, error) {
	var u model.User
	err := h.db.QueryRow(ctx,
		`SELECT id, account_id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.AccountID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (h *AuthHandler) fetchUserByID(ctx context.Context, id string) (model.User, error) {
	var u model.User
	err := h.db.QueryRow(ctx,
		`SELECT id, account_id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.AccountID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

var accountIDRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func isValidAccountID(s string) bool {
	return accountIDRegex.MatchString(s)
}
