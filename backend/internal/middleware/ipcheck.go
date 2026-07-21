package middleware

import (
	"log/slog"
	"net/http"

	"github.com/XiaoleC05/oxelia51-backend/internal/domain/admin"
	"github.com/gin-gonic/gin"
)

// IPWhitelist 返回一个中间件，校验请求者 IP 是否在白名单中。
// 白名单为空时放行所有；DB 故障时放行以避免锁死管理员。
func IPWhitelist(repo *admin.WhitelistRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		allowed, err := repo.IsAllowed(c.Request.Context(), c.ClientIP())
		if err != nil {
			// DB 故障时放行，避免锁死所有管理员
			slog.Warn("ip whitelist check failed, allowing", "error", err, "ip", c.ClientIP())
			c.Next()
			return
		}
		if !allowed {
			slog.Warn("ip blocked", "ip", c.ClientIP())
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "IP 不在白名单中",
				"code":  "IP_NOT_ALLOWED",
			})
			return
		}
		c.Next()
	}
}
