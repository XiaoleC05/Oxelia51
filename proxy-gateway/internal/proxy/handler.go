package proxy

import (
	"net/http"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/limiter"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/stats"
)

// SetupRoutes 注册所有代理网关路由
func SetupRoutes(
	mux *http.ServeMux,
	forwarder *Forwarder,
	lm *limiter.RateLimiter,
	providers []string,
	startTime time.Time,
	st *stats.Stats,
) {
	// 健康检查
	mux.HandleFunc("/health", HealthHandler)

	// 代理状态（含实时统计）
	mux.HandleFunc("/api/proxy/status", statusJSONHandler(providers, startTime, st))

	// 代理路由（带中间件链）
	proxyHandler := ChainMiddleware(
		http.HandlerFunc(forwarder.ServeHTTP),
		recovery,
		projectAuth,
		rateLimit(lm),
	)
	mux.Handle("/api/proxy/", proxyHandler)
}
