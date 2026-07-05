package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/XiaoleC05/oxelia51-backend/internal/auth"
	"github.com/XiaoleC05/oxelia51-backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AuthMiddleware struct {
	cfg       *config.Config
	tokens    *auth.TokenService
	blacklist *auth.JWTBlacklist
}

func NewAuthMiddleware(cfg *config.Config, tokens *auth.TokenService, blacklist *auth.JWTBlacklist) *AuthMiddleware {
	return &AuthMiddleware{cfg: cfg, tokens: tokens, blacklist: blacklist}
}

func (m *AuthMiddleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌", "code": "UNAUTHORIZED"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请求头格式错误", "code": "UNAUTHORIZED"})
			c.Abort()
			return
		}

		claims, err := m.tokens.ParseAccess(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效或已过期的令牌", "code": "UNAUTHORIZED"})
			c.Abort()
			return
		}

		jti, _ := claims["jti"].(string)
		if jti != "" {
			blocked, err := m.blacklist.Has(c.Request.Context(), jti)
			if err == nil && blocked {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌已失效", "code": "UNAUTHORIZED"})
				c.Abort()
				return
			}
		}

		sub := claimInt64(claims, "sub")
		role := claimString(claims, "role")
		username := claimString(claims, "username")
		exp := claimInt64(claims, "exp")

		c.Set("userID", sub)
		c.Set("userRole", role)
		c.Set("username", username)
		c.Set("jti", jti)
		c.Set("tokenExp", exp)

		c.Next()
	}
}

func claimString(claims jwt.MapClaims, key string) string {
	v, ok := claims[key]
	if !ok || v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprint(v)
}

func claimInt64(claims jwt.MapClaims, key string) int64 {
	v, ok := claims[key]
	if !ok || v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return int64(n)
	case int64:
		return n
	case int:
		return int64(n)
	case json.Number:
		i, err := n.Int64()
		if err != nil {
			return 0
		}
		return i
	default:
		return 0
	}
}

// RequireAdmin ensures role=admin
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限", "code": "FORBIDDEN"})
			c.Abort()
			return
		}
		c.Next()
	}
}
