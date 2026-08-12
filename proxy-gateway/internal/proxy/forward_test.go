package proxy

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/stats"
)

// TestDecodeBody 锁住 #1：gzip 响应必须被解压成可解析的明文 JSON。
func TestDecodeBody(t *testing.T) {
	plain := []byte(`{"usage":{"prompt_tokens":777,"completion_tokens":333,"total_tokens":1110}}`)

	// 构造 gzip 字节
	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	zw.Write(plain)
	zw.Close()

	cases := []struct {
		name     string
		raw      []byte
		encoding string
		want     []byte
	}{
		{"identity 原样返回", plain, "identity", plain},
		{"空 encoding 原样返回", plain, "", plain},
		{"gzip 解压", gz.Bytes(), "gzip", plain},
		{"gzip 大小写不敏感", gz.Bytes(), "GZIP", plain},
		{"声称 gzip 但不是 gzip → 回退原字节", []byte("not gzip"), "gzip", []byte("not gzip")},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := decodeBody(c.raw, c.encoding)
			if !bytes.Equal(got, c.want) {
				t.Fatalf("decodeBody got %q, want %q", got, c.want)
			}
		})
	}
}

// TestSSERecorderPartialFlag 验证流式响应的 partial 标记（#11）
func TestSSERecorderPartialFlag(t *testing.T) {
	tests := []struct {
		name        string
		sseData     string
		wantPartial bool
	}{
		{
			name: "OpenAI 完整流（遇到 [DONE]）",
			sseData: `data: {"choices":[{"delta":{"content":"hello"}}]}

data: [DONE]

`,
			wantPartial: false,
		},
		{
			name: "Anthropic 完整流（遇到 message_stop）",
			sseData: `event: message_start
data: {"type":"message_start"}

event: content_block_delta
data: {"delta":{"text":"world"}}

event: message_stop
data: {"type":"message_stop"}

`,
			wantPartial: false,
		},
		{
			name: "客户端中断（无完成标记）",
			sseData: `data: {"choices":[{"delta":{"content":"partial response"}}]}

`,
			wantPartial: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 用于捕获 record 回调
			var gotPartial bool
			var recordCalled bool

			// 创建 mock source
			source := io.NopCloser(strings.NewReader(tt.sseData))

			rec := &sseRecorder{
				source:   source,
				adapter:  &mockAdapter{},
				encoding: "",
				record: func(usage *adapter.TokenUsage, partial bool) {
					recordCalled = true
					gotPartial = partial
				},
			}

			// 模拟客户端读取整个流
			io.Copy(io.Discard, rec)

			// 关闭时触发 record 回调
			rec.Close()

			if !recordCalled {
				t.Error("record callback was not called")
			}
			if gotPartial != tt.wantPartial {
				t.Errorf("partial = %v, want %v", gotPartial, tt.wantPartial)
			}
		})
	}
}

// mockAdapter 用于测试
type mockAdapter struct{}

func (m *mockAdapter) ProviderName() string {
	return "test-provider"
}

func (m *mockAdapter) ExtractUsage(resp *http.Response) (*adapter.TokenUsage, error) {
	return &adapter.TokenUsage{PromptTokens: 10, CompletionTokens: 20}, nil
}

func (m *mockAdapter) ExtractUsageFromStream(stream io.Reader) (*adapter.TokenUsage, error) {
	return &adapter.TokenUsage{PromptTokens: 10, CompletionTokens: 20}, nil
}

// ---------- P2-1 / P2-3：Forwarder 落账行为集成测试 ----------

// captureRecorder 捕获所有落账记录（实现 recorder.Recorder 接口）。
type captureRecorder struct {
	mu   sync.Mutex
	recs []adapter.TokenRecord
}

func (c *captureRecorder) Record(r adapter.TokenRecord) {
	c.mu.Lock()
	c.recs = append(c.recs, r)
	c.mu.Unlock()
}
func (c *captureRecorder) Flush() {}
func (c *captureRecorder) Close() {}

func (c *captureRecorder) records() []adapter.TokenRecord {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]adapter.TokenRecord, len(c.recs))
	copy(out, c.recs)
	return out
}

// withUpstream 把 Forwarder 的全部上游指向 mock server（覆盖包级 upstreamBase 钩子）。
func withUpstream(t *testing.T, handler http.HandlerFunc) (*Forwarder, *captureRecorder) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	prev := upstreamBase
	upstreamBase = u
	t.Cleanup(func() { upstreamBase = prev })

	rec := &captureRecorder{}
	return NewForwarder(adapter.NewRegistry(), rec, stats.New()), rec
}

// doProxyReq 经 Forwarder 发一笔 OpenAI 协议请求。
func doProxyReq(t *testing.T, f *Forwarder, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/proxy/openai/v1/chat/completions", strings.NewReader(body))
	req.Header.Set("X-Project-ID", "p-test")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	f.ServeHTTP(w, req)
	return w
}

// TestNon2xxNotRecorded 锁住 P2-1：429/4xx/5xx 不落 0-token 垃圾行。
func TestNon2xxNotRecorded(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusBadRequest, http.StatusInternalServerError} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			f, rec := withUpstream(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				w.Write([]byte(`{"error":{"message":"rate limited"}}`))
			})
			w := doProxyReq(t, f, `{"model":"mock-model","messages":[]}`)
			if w.Code != status {
				t.Fatalf("client should see upstream status %d, got %d", status, w.Code)
			}
			if n := len(rec.records()); n != 0 {
				t.Fatalf("non-2xx must not be recorded, got %d records: %+v", n, rec.records())
			}
		})
	}
}

// Test2xxWithoutUsageStillRecorded 锁住 P2-1 的可见性口径：2xx 但无 usage 仍落账
// （0 token + model），区别于「model 也为空」的纯垃圾行。
func Test2xxWithoutUsageStillRecorded(t *testing.T) {
	f, rec := withUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"id":"x","choices":[{"message":{"role":"assistant","content":"hi"}}]}`))
	})
	w := doProxyReq(t, f, `{"model":"mock-model","messages":[]}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status: %d", w.Code)
	}
	recs := rec.records()
	if len(recs) != 1 {
		t.Fatalf("2xx without usage should record 1 row, got %d", len(recs))
	}
	if recs[0].Model != "mock-model" || recs[0].TotalTokens != 0 {
		t.Fatalf("record broken: %+v", recs[0])
	}
}

// TestEmptyModelZeroUsageNotRecorded 锁住 P2-1 防御：model 空 + usage 全 0 不落；
// model 空但 usage 非 0（上游自报 usage）仍落。
func TestEmptyModelZeroUsageNotRecorded(t *testing.T) {
	// model 空 + 0 usage → 不落
	f, rec := withUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"choices":[]}`))
	})
	doProxyReq(t, f, `{"messages":[]}`)
	if n := len(rec.records()); n != 0 {
		t.Fatalf("empty model + zero usage must not record, got %d", n)
	}

	// model 空 + 上游给了 usage → 落（有 token 量就有分析价值）
	f2, rec2 := withUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}`))
	})
	doProxyReq(t, f2, `{"messages":[]}`)
	if n := len(rec2.records()); n != 1 {
		t.Fatalf("empty model but real usage should record, got %d", n)
	}
}

// TestStreamDurationCoversWholeStream 锁住 P2-3：流式 duration 在流结束时定，
// 覆盖全程耗时（明显大于首字节耗时，原实现记成 ~1ms）。
func TestStreamDurationCoversWholeStream(t *testing.T) {
	f, rec := withUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fl, _ := w.(http.Flusher)
		chunks := []string{
			`data: {"id":"c1","choices":[{"delta":{"content":"Hello"}}]}`,
			`data: {"id":"c1","choices":[{"delta":{"content":" world"}}]}`,
			`data: {"id":"c1","choices":[],"usage":{"prompt_tokens":120,"completion_tokens":30,"total_tokens":150}}`,
			`data: [DONE]`,
		}
		for _, c := range chunks {
			io.WriteString(w, c+"\n\n")
			if fl != nil {
				fl.Flush()
			}
			time.Sleep(120 * time.Millisecond) // 全程 ~480ms，首字节 <100ms
		}
	})
	w := doProxyReq(t, f, `{"model":"mock-model","stream":true,"messages":[]}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status: %d", w.Code)
	}
	recs := rec.records()
	if len(recs) != 1 {
		t.Fatalf("stream should record 1 row, got %d", len(recs))
	}
	if recs[0].TotalTokens != 150 {
		t.Fatalf("stream usage broken: %+v", recs[0])
	}
	// 首字节即定 duration 的实现只会记到 <120ms；流结束时应 ≥ 3 个 chunk 间隔
	if recs[0].DurationMs < 300 {
		t.Fatalf("stream duration should cover whole stream (>=300ms), got %dms", recs[0].DurationMs)
	}
}

// TestStreamNon2xxNotRecorded 锁住 P2-1 流式分支：非 2xx 即使带 SSE 头也不落账。
func TestStreamNon2xxNotRecorded(t *testing.T) {
	f, rec := withUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusTooManyRequests)
		io.WriteString(w, `data: {"error":"rate limited"}`+"\n\n")
	})
	w := doProxyReq(t, f, `{"model":"mock-model","stream":true,"messages":[]}`)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("status: %d", w.Code)
	}
	if n := len(rec.records()); n != 0 {
		t.Fatalf("non-2xx stream must not record, got %d", n)
	}
}

// TestBuildRecordCacheAccounting 锁住缓存记账口径：
// TotalTokens 存原始 token（含缓存，1×），PromptTokens 存计价输入（缓存折算），
// 缓存细分单独落 CacheRead/CacheCreation 列。Anthropic 的 input_tokens 不含缓存，
// 故原始输入 = input + cache_creation + cache_read。
func TestBuildRecordCacheAccounting(t *testing.T) {
	u := &adapter.TokenUsage{
		PromptTokens:        100,
		CompletionTokens:    50,
		CacheCreationTokens: 20000,
		CacheReadTokens:     300000,
	}
	r := buildRecord(u, "p", "s", "anthropic", "claude-code", "claude-opus-5", 100, false)

	// 计价输入：100 + 20000×1.25 + 300000×0.1 = 55100
	if r.PromptTokens != 55100 {
		t.Fatalf("prompt(billing) = %d, want 55100", r.PromptTokens)
	}
	// 原始输入：100 + 20000 + 300000 = 320100；原始总量 = 320100 + 50 = 320150
	if r.TotalTokens != 320150 {
		t.Fatalf("total(raw) = %d, want 320150", r.TotalTokens)
	}
	if r.CacheReadTokens != 300000 || r.CacheCreationTokens != 20000 {
		t.Fatalf("cache cols: read=%d create=%d, want 300000/20000", r.CacheReadTokens, r.CacheCreationTokens)
	}
}
