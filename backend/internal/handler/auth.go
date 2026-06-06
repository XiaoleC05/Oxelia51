package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthHandler 认证相关接口处理器
type AuthHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(db *pgxpool.Pool, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

// Register 处理用户注册 POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	// 1. 密码哈希 —— bcrypt.GenerateFromPassword 加盐并哈希
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码处理失败"})
		return
	}

	// 2. 写入数据库
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var user model.User
	err = h.db.QueryRow(ctx,
		`INSERT INTO users (username, password, email)
		 VALUES ($1, $2, $3)
		 RETURNING id, username, email, role, created_at, updated_at`,
		req.Username, string(hash), req.Email,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		// pgx 的错误信息包含 "unique" 字样 = 用户名或邮箱重复
		c.JSON(http.StatusConflict, gin.H{"error": "用户名或邮箱已存在"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// Login 处理用户登录 POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	// 1. 查用户
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var user model.User
	err := h.db.QueryRow(ctx,
		`SELECT id, username, password, email, role, created_at, updated_at
		 FROM users WHERE username = $1`,
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Email,
		&user.Role, &user.CreatedAt, &user.UpdatedAt)

	// 2. 用户不存在
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// 3. 验密码 —— bcrypt.CompareHashAndPassword 比对哈希
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// 4. 签发 JWT
	token, err := h.generateJWT(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "令牌生成失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

// generateJWT 为用户签发 JWT 令牌，有效期 24 小时
func (h *AuthHandler) generateJWT(user model.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  user.ID,                               // subject —— 用户 ID
		"usr":  user.Username,                         // 用户名
		"role": user.Role,                             // 角色
		"exp":  time.Now().Add(24 * time.Hour).Unix(), // 过期时间
		"iat":  time.Now().Unix(),                     // 签发时间
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}
