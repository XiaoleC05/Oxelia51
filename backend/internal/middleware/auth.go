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
		tokenString := extractAccessToken(c)
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌", "code": "UNAUTHORIZED"})
			c.Abort()
			return
		}

		claims, err := m.tokens.ParseAccess(tokenString)
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
		emailVerified := claimBool(claims, "email_verified")

		// 纵深防御：Login 已拦截未验证用户获 JWT，此处二次校验 claim，
		// 防止 JWT 泄漏/旧 token/异常签发路径绕过邮箱验证。
		// 缺少该 claim 的旧 token 视为未验证，强制重新登录。
		if !emailVerified {
			c.JSON(http.StatusForbidden, gin.H{"error": "邮箱未验证，请完成验证后重新登录", "code": "EMAIL_NOT_VERIFIED"})
			c.Abort()
			return
		}

		c.Set("userID", sub)
		c.Set("userRole", role)
		c.Set("username", username)
		c.Set("jti", jti)
		c.Set("tokenExp", exp)
		c.Set("emailVerified", emailVerified)

		c.Next()
	}
}

// extractAccessToken 优先 Authorization Bearer；Nginx/CDN 可能丢弃该头，备用 X-Oxelia51-Access-Token
func extractAccessToken(c *gin.Context) string {
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") && parts[1] != "" {
			return parts[1]
		}
	}
	return strings.TrimSpace(c.GetHeader("X-Oxelia51-Access-Token"))
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

func claimBool(claims jwt.MapClaims, key string) bool {
	v, ok := claims[key]
	if !ok || v == nil {
		return false
	}
	switch b := v.(type) {
	case bool:
		return b
	case string:
		return b == "true"
	default:
		return false
	}
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
