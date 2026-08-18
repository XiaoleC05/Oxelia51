package middleware

import (
	"log/slog"
	"net/http"

	"github.com/XiaoleC05/oxelia51-backend/internal/domain/admin"
	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
)

// IPWhitelist 返回一个中间件，校验请求者 IP 是否在白名单中（#13：fail-close）。
// DB 故障时拒绝（保护 /api/admin/exec RCE 接口）；紧急救援用 OXELIA_BREAK_GLASS_IP。
func IPWhitelist(repo *admin.WhitelistRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := infra.ClientIP(c)
		allowed, err := repo.IsAllowed(c.Request.Context(), ip)
		if err != nil {
			// fail-close：DB 故障时拒绝，避免 RCE 接口在 DB 抖动期对所有人开放。
			// 紧急情况设 OXELIA_BREAK_GLASS_IP 环境变量（IsAllowed 内部判定）。
			slog.Warn("ip whitelist check failed, denying", "error", err, "ip", ip)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "IP 白名单校验不可用，已拒绝（紧急救援请设 OXELIA_BREAK_GLASS_IP）",
				"code":  "IP_CHECK_FAILED",
			})
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
