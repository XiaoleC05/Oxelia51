package infra

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// ClientIP 返回可信的客户端真实 IP，按优先级：
//  1. X-Real-IP（nginx 设为可信对端 $remote_addr，客户端不可伪造）
//  2. X-Oxelia51-Client-IP（nginx 已覆盖为真实 IP，见 oxelia51.com.conf）
//  3. 连接地址（直连时即真实 IP）
//
// 禁止信任客户端可写的 X-Forwarded-For 首段或 X-Oxelia51-Client-IP 原始值，
// 否则可伪造 IP 绕过命令执行接口的白名单校验。
func ClientIP(c *gin.Context) string {
	if ip := strings.TrimSpace(c.GetHeader("X-Real-IP")); ip != "" {
		return ip
	}
	if ip := strings.TrimSpace(c.GetHeader("X-Oxelia51-Client-IP")); ip != "" {
		return ip
	}
	return c.ClientIP()
}
