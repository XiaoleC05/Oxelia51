package proxy

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/limiter"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/stats"
)

type contextKey string

const projectIDKey contextKey = "project_id"

func contextWithProjectID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, projectIDKey, id)
}

func projectIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(projectIDKey).(string)
	return v
}

// projectAuth 校验 X-Project-ID 头存在且非空
func projectAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		projectID := r.Header.Get("X-Project-ID")
		if strings.TrimSpace(projectID) == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "缺少 X-Project-ID 头",
				"code":  "MISSING_PROJECT_ID",
			})
			return
		}
		ctx := contextWithProjectID(r.Context(), projectID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// rateLimit 基于 project 维度的 token bucket 限流
func rateLimit(limiter *limiter.RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			projectID := projectIDFromContext(r.Context())
			if projectID != "" && !limiter.Allow(projectID) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "请求过于频繁",
					"code":  "RATE_LIMITED",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// recovery 捕获 panic 返回 500
func recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic recovered: %v\n%s", rec, debug.Stack())
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "内部错误",
					"code":  "INTERNAL_ERROR",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// statusJSONHandler 返回代理状态 + 实时统计（QPS/延迟/成功率/供应商分布）
func statusJSONHandler(providers []string, startTime time.Time, st *stats.Stats) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		providerMap := map[string]map[string]string{}
		for _, p := range providers {
			providerMap[p] = map[string]string{"status": "ok"}
		}
		var snap stats.Snapshot
		if st != nil {
			snap = st.Snapshot()
		} else {
			snap.Status = "ok"
			snap.UptimeSec = int64(time.Since(startTime).Seconds())
			snap.ByProvider = []stats.ProviderStat{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    snap.Status,
			"uptime":    time.Since(startTime).String(),
			"uptimeSec": snap.UptimeSec,
			"stats":     snap,
			"providers": providerMap,
		})
	}
}

// ChainMiddleware 链式组合中间件
func ChainMiddleware(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}
