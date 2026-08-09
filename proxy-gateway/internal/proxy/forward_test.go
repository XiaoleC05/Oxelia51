package proxy

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
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
