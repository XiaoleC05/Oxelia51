package middleware

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/XiaoleC05/oxelia51-backend/internal/domain/admin"
	"github.com/gin-gonic/gin"
)

// clientIP 返回可信的客户端真实 IP，按优先级：
//  1. X-Real-IP（nginx 设为可信对端 $remote_addr，客户端不可伪造）
//  2. X-Oxelia51-Client-IP（nginx 已覆盖为真实 IP，见 oxelia51.com.conf）
//  3. 连接地址（直连时即真实 IP）
//
// 禁止信任客户端可写的 X-Forwarded-For 首段或 X-Oxelia51-Client-IP 原始值，
// 否则可伪造 IP 绕过命令执行接口的白名单校验。
func clientIP(c *gin.Context) string {
	if ip := strings.TrimSpace(c.GetHeader("X-Real-IP")); ip != "" {
		return ip
	}
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
