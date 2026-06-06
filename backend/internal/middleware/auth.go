package middleware

import (
	"net/http"
	"strings"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware 验证 JWT 令牌的中间件
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 从 Header 获取 Authorization
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
			c.Abort() // 拦截请求，不再执行后续的 Handler
			return
		}

		// 2. 解析 Bearer 格式 (例如: "Bearer eyJhbGciOi...")
		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请求头格式错误，应为 Bearer <token>"})
			c.Abort()
			return
		}
		tokenString := parts[1]

		// 3. 解析并验证 Token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// 验证签名算法是否为 HMAC-SHA256
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(cfg.JWTSecret), nil
		})

		// 4. 验证失败或 Token 无效
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效或已过期的令牌"})
			c.Abort()
			return
		}

		// 5. 解析 Payload (Claims) 并存入 Context
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "解析令牌声明失败"})
			c.Abort()
			return
		}

		// 将用户 ID 和角色存入 Gin 上下文，方便后续 Handler 获取
		c.Set("userID", claims["sub"])
		c.Set("userRole", claims["role"])

		c.Next() // 放行，继续执行后续的 Handler
	}
}
