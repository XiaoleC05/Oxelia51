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

// anonymousProjectID optional 鉴权模式下无密钥请求的统一匿名项目：
// 防客户端伪造 X-Project-ID 把用量归属到任意项目。
const anonymousProjectID = "anonymous"

func contextWithProjectID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, projectIDKey, id)
}

func projectIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(projectIDKey).(string)
	return v
}

// extractKey 从请求中提取代理密钥（Bearer <k> 或 x-api-key <k>）。
func extractKey(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if len(auth) > 7 && strings.EqualFold(auth[:7], "Bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return strings.TrimSpace(r.Header.Get("X-Api-Key"))
}

func writeJSON(w http.ResponseWriter, status int, body map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// keyAuth 代理密钥鉴权：Bearer <key> 或 x-api-key <key> → 查 proxy_keys →
// 用 key 解析出的 project_id 覆盖 X-Project-ID（防伪造）。
// authMode: "required" 强制密钥；"optional"（默认）无密钥时放行但忽略客户端
// X-Project-ID，统一归并到固定匿名项目（防用量归属伪造）。
func keyAuth(ks *KeyStore, authMode string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := extractKey(r)
			if ks == nil {
				// 本地优先模式（无代理密钥库）：key 即客户端真实上游 key，透传上行；
				// 项目默认 "local"，个人本地单一账本。
				if key != "" {
					r.Header.Set("X-Oxelia51-Upstream-Key", key)
				}
				r.Header.Del("Authorization")
				r.Header.Del("X-Api-Key")
				projectID := strings.TrimSpace(r.Header.Get("X-Project-ID"))
				if projectID == "" {
					projectID = "local"
					r.Header.Set("X-Project-ID", projectID)
				}
				ctx := contextWithProjectID(r.Context(), projectID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			if key != "" {
				projectID, enabled, ok := ks.Resolve(r.Context(), key)
				if !ok || !enabled {
					writeJSON(w, http.StatusUnauthorized, map[string]string{
						"error": "无效的 API 密钥",
						"code":  "INVALID_API_KEY",
					})
					return
				}
				// 用密钥映射的 project_id 覆盖 header（客户端自填 X-Project-ID 无效）
				r.Header.Set("X-Project-ID", projectID)
				// 代理密钥不向上游泄漏
				r.Header.Del("Authorization")
				r.Header.Del("X-Api-Key")
				ctx := contextWithProjectID(r.Context(), projectID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// 无密钥
			if authMode == "required" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "缺少 API 密钥",
					"code":  "MISSING_API_KEY",
				})
				return
			}
			// optional：无密钥请求不采纳客户端自填的 X-Project-ID（可任意伪造，
			// 会把用量记到他人/任意项目头上），统一归并到固定匿名项目。
			r.Header.Set("X-Project-ID", anonymousProjectID)
			ctx := contextWithProjectID(r.Context(), anonymousProjectID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
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
