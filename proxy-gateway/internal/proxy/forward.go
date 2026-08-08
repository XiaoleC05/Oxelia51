package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/recorder"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/stats"
	"github.com/google/uuid"
)

// Forwarder 核心反向代理
type Forwarder struct {
	registry *adapter.Registry
	recorder recorder.Recorder
	stats    *stats.Stats
}

// upstreamBase 测试/演示钩子：设置 PROXY_UPSTREAM_BASE 时，把所有上游请求改指到该
// 地址（如本地 mock LLM http://127.0.0.1:9000），用于本地 E2E 验证与离线演示。
// 生产云模式不设置该 env，行为与原来完全一致。
var upstreamBase = func() *url.URL {
	base := strings.TrimSpace(os.Getenv("PROXY_UPSTREAM_BASE"))
	if base == "" {
		return nil
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return nil
	}
	return u
}()

func NewForwarder(reg *adapter.Registry, rec recorder.Recorder, st *stats.Stats) *Forwarder {
	return &Forwarder{
		registry: reg,
		recorder: rec,
		stats:    st,
	}
}

// sseRecorder 包装 SSE 流式响应体，在流结束后解析 usage
type sseRecorder struct {
	source  io.ReadCloser
	buffer  bytes.Buffer
	adapter adapter.Adapter
	record  func(*adapter.TokenUsage)
}

func (r *sseRecorder) Read(p []byte) (int, error) {
	n, err := r.source.Read(p)
	if n > 0 {
		r.buffer.Write(p[:n])
	}
	return n, err
}

func (r *sseRecorder) Close() error {
	// 流结束，解析 usage
	if r.buffer.Len() > 0 {
		usage, _ := r.adapter.ExtractUsageFromStream(&r.buffer)
		if usage != nil {
			r.record(usage)
		}
	}
	return r.source.Close()
}

func (f *Forwarder) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 1) 匹配路由
	route, prefix := f.registry.Match(r.URL.Path)
	if route == nil {
		http.Error(w, `{"error":"unknown provider","code":"PROVIDER_NOT_FOUND"}`, http.StatusNotFound)
		return
	}

	// 2) 提取 project ID + session ID
	projectID := r.Header.Get("X-Project-ID")
	if strings.TrimSpace(projectID) == "" {
		http.Error(w, `{"error":"missing X-Project-ID","code":"MISSING_PROJECT_ID"}`, http.StatusBadRequest)
		return
	}
	sessionID := r.Header.Get("X-Session-ID")
	if sessionID == "" {
		sessionID = uuid.NewString()
	}

	// 3) 读取请求体提取 model + stream 标志
	var requestBody []byte
	if r.Body != nil {
		requestBody, _ = io.ReadAll(r.Body)
		r.Body.Close()
		r.Body = io.NopCloser(bytes.NewReader(requestBody))
	}
	model := extractModel(requestBody)
	stream := isStreamRequest(requestBody)

	// 4) 解析上游 URL（拼接供应商路径前缀）
	upstreamPath := route.PathPrefix + "/" + strings.TrimPrefix(f.registry.ResolveTarget(r.URL.Path, prefix), "/")
	targetURL := &url.URL{
		Scheme: "https",
		Host:   route.Target,
		Path:   "/" + strings.TrimPrefix(upstreamPath, "/"),
	}
	if upstreamBase != nil {
		targetURL.Scheme = upstreamBase.Scheme
		targetURL.Host = upstreamBase.Host
	}

	start := time.Now()
	provider := route.Adapter.ProviderName()

	// 5) 创建反向代理
	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL = targetURL
			if upstreamBase != nil {
				req.Host = upstreamBase.Host
			} else {
				req.Host = route.Target
			}

			// Oxelia51 产品化：客户端真实上游 LLM key 经 X-Oxelia51-Upstream-Key 传递，
			// 按供应商协议写回鉴权头（Anthropic 用 x-api-key，OpenAI 兼容系用 Authorization）。
			// 该头由中间件 keyAuth 校验代理密钥后保留；代理密钥本身不上行。
			if k := req.Header.Get("X-Oxelia51-Upstream-Key"); k != "" {
				req.Header.Del("X-Oxelia51-Upstream-Key")
				if route.Adapter.ProviderName() == "anthropic" {
					req.Header.Set("x-api-key", k)
				} else {
					req.Header.Set("Authorization", "Bearer "+k)
				}
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			duration := uint32(time.Since(start).Milliseconds())

			// Oxelia51 网关统计：记录成功请求 + 延迟
			f.stats.Record(provider, time.Since(start), resp.StatusCode < 400)

			isStream := stream || strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream")

			if isStream {
				// 流式：包装 body 为 sseRecorder
				originalBody := resp.Body
				resp.Body = &sseRecorder{
					source:  originalBody,
					adapter: route.Adapter,
					record: func(usage *adapter.TokenUsage) {
						f.recorder.Record(adapter.TokenRecord{
							EventID:          uuid.NewString(),
							ProjectID:        projectID,
							SessionID:        sessionID,
							Provider:         provider,
							Model:            model,
							PromptTokens:     uint32(usage.PromptTokens),
							CompletionTokens: uint32(usage.CompletionTokens),
							TotalTokens:      uint32(usage.TotalTokens),
							DurationMs:       duration,
							Timestamp:        time.Now(),
						})
					},
				}
				return nil
			}

			// 非流式：读取完整 body，提取 usage，恢复 body
			rawBody, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				return err
			}

			// 用临时 response 供 adapter 读取
			tmpResp := &http.Response{Body: io.NopCloser(bytes.NewReader(rawBody))}
			usage, err := route.Adapter.ExtractUsage(tmpResp)
			if err != nil {
				log.Printf("extract usage failed: %v", err)
			}

			// 恢复 body 给客户端
			resp.Body = io.NopCloser(bytes.NewReader(rawBody))
			resp.ContentLength = int64(len(rawBody))

			if usage != nil {
				f.recorder.Record(adapter.TokenRecord{
					EventID:          uuid.NewString(),
					ProjectID:        projectID,
					SessionID:        sessionID,
					Provider:         provider,
					Model:            model,
					PromptTokens:     uint32(usage.PromptTokens),
					CompletionTokens: uint32(usage.CompletionTokens),
					TotalTokens:      uint32(usage.TotalTokens),
					DurationMs:       duration,
					Timestamp:        time.Now(),
				})
			}

			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("proxy error: %v", err)
			// Oxelia51 网关统计：记录失败请求
			f.stats.Record(provider, time.Since(start), false)
			if err == context.DeadlineExceeded {
				http.Error(w, `{"error":"upstream timeout","code":"UPSTREAM_TIMEOUT"}`, http.StatusGatewayTimeout)
				return
			}
			http.Error(w, `{"error":"upstream unavailable","code":"UPSTREAM_UNAVAILABLE"}`, http.StatusBadGateway)
		},
	}

	proxy.ServeHTTP(w, r)
}

// HealthHandler 健康检查
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

// extractModel 从请求体中提取 model 字段
func extractModel(body []byte) string {
	var data struct {
		Model string `json:"model"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return ""
	}
	return data.Model
}

// isStreamRequest 从请求体判断是否为流式请求
func isStreamRequest(body []byte) bool {
	var data struct {
		Stream bool `json:"stream"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return false
	}
	return data.Stream
}

