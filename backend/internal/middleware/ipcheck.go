package middleware

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/XiaoleC05/oxelia51-backend/internal/domain/admin"
	"github.com/gin-gonic/gin"
)

// clientIP 优先取 Langfuse 服务端转发的浏览器真实出口 IP（X-Oxelia51-Client-IP），
// 回退到连接地址。直连时即真实 IP；经 nginx 时取 X-Forwarded-For 首段。
func clientIP(c *gin.Context) string {
	if ip := strings.TrimSpace(c.GetHeader("X-Oxelia51-Client-IP")); ip != "" {
		return ip
	}
	return c.ClientIP()
}

// IPWhitelist 返回一个中间件，校验请求者 IP 是否在白名单中。
// 白名单为空时放行所有；DB 故障时放行以避免锁死管理员。
func IPWhitelist(repo *admin.WhitelistRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := clientIP(c)
		allowed, err := repo.IsAllowed(c.Request.Context(), ip)
		if err != nil {
			// DB 故障时放行，避免锁死所有管理员
			slog.Warn("ip whitelist check failed, allowing", "error", err, "ip", ip)
			c.Next()
			return
		}
		if !allowed {
			slog.Warn("ip blocked", "ip", ip)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "IP 不在白名单中",
				"code":  "IP_NOT_ALLOWED",
			})
			return
		}
		c.Next()
	}
}
