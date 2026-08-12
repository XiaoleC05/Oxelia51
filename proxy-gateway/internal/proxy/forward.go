package proxy

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"log"
	"math"
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
	sessions *Sessionizer // #6：无 X-Session-ID 时按指纹+空闲窗口推断
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
		sessions: NewSessionizer(30 * time.Minute),
	}
}

// sseRecorder 包装 SSE 流式响应体，在流结束后解析 usage
type sseRecorder struct {
	source    io.ReadCloser
	buffer    bytes.Buffer
	adapter   adapter.Adapter
	record    func(*adapter.TokenUsage, bool) // #11: 新增 partial 参数
	encoding  string                          // 上游 Content-Encoding（gzip 时 Close 时解压再解析，#1）
	completed bool                            // #11: 流是否完整结束（遇到 [DONE] / message_stop）
}

func (r *sseRecorder) Read(p []byte) (int, error) {
	n, err := r.source.Read(p)
	if n > 0 {
		r.buffer.Write(p[:n])
		// #11: 检测流式响应完成标记
		// OpenAI: data: [DONE]
		// Anthropic: event: message_stop
		chunk := string(p[:n])
		if strings.Contains(chunk, "data: [DONE]") || strings.Contains(chunk, "event: message_stop") {
			r.completed = true
		}
	}
	return n, err
}

func (r *sseRecorder) Close() error {
	// 流结束，解析 usage；gzip 流先解压再扫描（#1）
	if r.buffer.Len() > 0 {
		data := r.buffer.Bytes()
		if strings.EqualFold(r.encoding, "gzip") {
			if zr, err := gzip.NewReader(bytes.NewReader(data)); err == nil {
				if dec, derr := io.ReadAll(io.LimitReader(zr, 8<<20)); derr == nil {
					data = dec
				}
				zr.Close()
			}
		}
		usage, _ := r.adapter.ExtractUsageFromStream(bytes.NewReader(data))
		if usage != nil {
			// #11: partial=true 表示客户端中断流式响应（未收到完成标记）
			r.record(usage, !r.completed)
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
		// #6：客户端不发 X-Session-ID 时按指纹+空闲窗口推断，避免每请求新会话
		sessionID = f.sessions.Get(sessionFingerprint(r))
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
	provider := route.Adapter.ProviderName()

	// Agent（用户使用的软件）：客户端头 X-Oxelia51-Agent 优先，否则按 UA 推断。
	agent := strings.TrimSpace(r.Header.Get("X-Oxelia51-Agent"))
	if agent == "" {
		agent = InferAgent(r.Header.Get("User-Agent"))
	}

	// #10：OpenAI 系流式默认末帧无 usage → 无法落账。
	// 注入 stream_options.include_usage（Anthropic 流式天然带 usage，跳过）。
	if stream && provider != "anthropic" {
		if modified := ensureStreamUsage(requestBody); modified != nil {
			requestBody = modified
			r.Body = io.NopCloser(bytes.NewReader(requestBody))
			r.ContentLength = int64(len(requestBody))
		}
	}

	// 4) 解析上游 URL（拼接供应商路径前缀）
	upstreamPath := route.PathPrefix + "/" + strings.TrimPrefix(f.registry.ResolveTarget(r.URL.Path, prefix), "/")
	scheme := route.Scheme
	if scheme == "" {
		scheme = "https" // 内置供应商默认 https；自定义供应商允许 http 回环
	}
	targetURL := &url.URL{
		Scheme:   scheme,
		Host:     route.Target,
		Path:     "/" + strings.TrimPrefix(upstreamPath, "/"),
		RawQuery: r.URL.RawQuery, // 透传查询串（Azure api-version / 部分 CDN 鉴权依赖）
	}
	if upstreamBase != nil {
		targetURL.Scheme = upstreamBase.Scheme
		targetURL.Host = upstreamBase.Host
	}

	start := time.Now()

	// 5) 创建反向代理
	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL = targetURL
			if upstreamBase != nil {
				req.Host = upstreamBase.Host
			} else {
				req.Host = route.Target
			}

			// 强制上游返回未压缩响应：usage 提取需读 JSON 明文，gzip 字节流会
			// 导致 json.Unmarshal 失败、整笔记录 token 为 0（#1）。
			// 本地回环场景带宽可忽略；云端亦由网关统一解压，不向客户端暴露此改动。
			req.Header.Set("Accept-Encoding", "identity")

			// Oxelia51 产品化：客户端真实上游 LLM 经 X-Oxelia51-Upstream-Key 传递，
			// 按供应商协议写回鉴权头（Anthropic 协议用 x-api-key，OpenAI 兼容系用 Authorization）。
			// 该头由中间件 keyAuth 校验代理密钥后保留；代理密钥本身不上行。
			if k := req.Header.Get("X-Oxelia51-Upstream-Key"); k != "" {
				req.Header.Del("X-Oxelia51-Upstream-Key")
				if route.XAPIKeyAuth {
					req.Header.Set("x-api-key", k)
				} else {
					req.Header.Set("Authorization", "Bearer "+k)
				}
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			// P2-3：流式响应的 duration 不在此定（此时只是首字节耗时），
			// 在 sseRecorder.Close（流结束/客户端断开）时按 time.Since(start) 重算，见下文。
			duration := uint32(time.Since(start).Milliseconds())

			// Oxelia51 网关统计：记录成功请求 + 延迟
			f.stats.Record(provider, time.Since(start), resp.StatusCode < 400)

			isStream := stream || strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream")

			// P2-1：仅 2xx 落账。429/4xx/5xx 的响应体是错误 JSON，ExtractUsage 对
			// 任意合法 JSON 恒返回非 nil 的 0-token usage，原实现会给限流/错误响应
			// 落一堆 0-token 垃圾行、虚增请求数（实测限流测试产生 629 条）。
			ok := resp.StatusCode >= 200 && resp.StatusCode < 300

			if isStream {
				if !ok {
					// 非 2xx：不包装、不落账，body 原样透传给客户端
					return nil
				}
				// 流式：包装 body 为 sseRecorder
				originalBody := resp.Body
				resp.Body = &sseRecorder{
					source:   originalBody,
					adapter:  route.Adapter,
					encoding: resp.Header.Get("Content-Encoding"),
					record: func(usage *adapter.TokenUsage, partial bool) {
						// P2-3：流式 duration 在流结束（Close 回调）时定，覆盖全程耗时；
						// partial=1 语义不变（已收到 usage 的客户端中断仍落账）。
						f.recordUsage(usage, projectID, sessionID, provider, agent, model, uint32(time.Since(start).Milliseconds()), partial)
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

			// 用解压后的明文提取 usage（#1：gzip 响应导致 token 丢失）
			decBody := decodeBody(rawBody, resp.Header.Get("Content-Encoding"))
			tmpResp := &http.Response{Body: io.NopCloser(bytes.NewReader(decBody))}
			usage, err := route.Adapter.ExtractUsage(tmpResp)
			if err != nil {
				log.Printf("extract usage failed: %v", err)
			}

			// 恢复 body 给客户端
			resp.Body = io.NopCloser(bytes.NewReader(rawBody))
			resp.ContentLength = int64(len(rawBody))

			// P2-1：仅 2xx 落账。2xx 但无 usage 的响应保持落账（0 token + model），
			// 可见性优先——用户能看到「请求成功但上游没给 usage」而非凭空消失。
			if usage != nil && ok {
				// #11: 非流式响应视为完整（partial=false）
				f.recordUsage(usage, projectID, sessionID, provider, agent, model, duration, false)
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

// ensureStreamUsage 对 OpenAI 系流式请求注入 stream_options.include_usage（#10）。
// 末帧才会带 usage，否则无法落账。返回修改后的 body；无需修改时返回 nil。
func ensureStreamUsage(body []byte) []byte {
	if len(body) == 0 {
		return nil
	}
	var data map[string]any
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}
	so, _ := data["stream_options"].(map[string]any)
	if so == nil {
		so = map[string]any{}
	}
	if v, ok := so["include_usage"]; ok && v == true {
		return nil // 已显式开启
	}
	so["include_usage"] = true
	data["stream_options"] = so
	out, err := json.Marshal(data)
	if err != nil {
		return nil
	}
	return out
}

// effectivePromptTokens 把 Anthropic prompt caching 折算成计价等效 input token（#4）。
// cache_creation 1.25×、cache_read 0.1×；折算后存入 PromptTokens，
// 使 costOf(pricing, model, prompt, completion) 无需改 schema 即可准确计成本。
// total = 折算 prompt + completion（略高于真实 token 数，但成本准确，UI 显示总量更合理）。
func effectivePromptTokens(usage *adapter.TokenUsage) uint32 {
	if usage == nil {
		return 0
	}
	eff := float64(usage.PromptTokens) +
		float64(usage.CacheCreationTokens)*1.25 +
		float64(usage.CacheReadTokens)*0.1
	return uint32(math.Round(eff))
}

// recordUsage 落一条账。P2-1 防御：model 为空且 usage 全 0 的行无分析价值
// （既不知道用了哪个模型也没有 token 量），不落账。
func (f *Forwarder) recordUsage(usage *adapter.TokenUsage, projectID, sessionID, provider, agent, model string, duration uint32, partial bool) {
	if model == "" && usage.PromptTokens == 0 && usage.CompletionTokens == 0 &&
		usage.CacheCreationTokens == 0 && usage.CacheReadTokens == 0 {
		return
	}
	f.recorder.Record(buildRecord(usage, projectID, sessionID, provider, agent, model, duration, partial))
}

// buildRecord 从 usage 构造一条 TokenRecord（#4：cache 折算进 PromptTokens）。
func buildRecord(usage *adapter.TokenUsage, projectID, sessionID, provider, agent, model string, duration uint32, partial bool) adapter.TokenRecord {
	prompt := effectivePromptTokens(usage)
	completion := uint32(usage.CompletionTokens)
	return adapter.TokenRecord{
		EventID:          uuid.NewString(),
		ProjectID:        projectID,
		SessionID:        sessionID,
		Provider:         provider,
		Agent:            agent,
		Model:            model,
		PromptTokens:     prompt,
		CompletionTokens: completion,
		TotalTokens:      prompt + completion,
		DurationMs:       duration,
		Timestamp:        time.Now(),
		Partial:          partial,
	}
}

// decodeBody 返回可用于 JSON 解析的明文字节。
// 上游可能忽略 Accept-Encoding: identity 仍返回 gzip（部分 CDN/网关强制压缩），
// 此时按 Content-Encoding 解压；解压失败则回退原字节（交由调用方报错）。
// 限制 8MB 防止解压炸弹。
func decodeBody(raw []byte, encoding string) []byte {
	if !strings.EqualFold(encoding, "gzip") {
		return raw
	}
	zr, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return raw
	}
	defer zr.Close()
	dec, err := io.ReadAll(io.LimitReader(zr, 8<<20))
	if err != nil || len(dec) == 0 {
		return raw
	}
	return dec
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
