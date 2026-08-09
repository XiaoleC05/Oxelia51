package adapter

import (
	"bytes"
	"io"
	"net/http"
	"testing"
)

func newResp(body []byte) *http.Response {
	return &http.Response{Body: io.NopCloser(bytes.NewReader(body))}
}

// TestExtractUsageCache 锁住 #4：Anthropic 非流式响应的 cache token 必须被解析。
func TestExtractUsageCache(t *testing.T) {
	a := NewAnthropicAdapter("anthropic")
	body := []byte(`{"model":"claude-opus-5","usage":{
		"input_tokens":100,"output_tokens":50,
		"cache_creation_input_tokens":20000,"cache_read_input_tokens":300000}}`)
	resp := newResp(body)
	u, err := a.ExtractUsage(resp)
	if err != nil || u == nil {
		t.Fatalf("ExtractUsage err=%v u=%v", err, u)
	}
	if u.CacheCreationTokens != 20000 || u.CacheReadTokens != 300000 {
		t.Fatalf("cache tokens: creation=%d read=%d, want 20000/300000", u.CacheCreationTokens, u.CacheReadTokens)
	}
	if u.PromptTokens != 100 || u.CompletionTokens != 50 {
		t.Fatalf("base tokens: in=%d out=%d, want 100/50", u.PromptTokens, u.CompletionTokens)
	}
}

// TestExtractUsageFromStreamCache 锁住 #4 + #15：流式 message_start(input+cache) 与
// message_delta(output) 累积合并，不被互相覆盖。
func TestExtractUsageFromStreamCache(t *testing.T) {
	a := NewAnthropicAdapter("anthropic")
	sse := bytes.NewReader([]byte(
		"event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":500,\"cache_creation_input_tokens\":20000,\"cache_read_input_tokens\":300000}}}\n\n" +
			"event: message_delta\ndata: {\"type\":\"message_delta\",\"usage\":{\"output_tokens\":222}}\n\n" +
			"event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"))
	u, err := a.ExtractUsageFromStream(sse)
	if err != nil || u == nil {
		t.Fatalf("ExtractUsageFromStream err=%v u=%v", err, u)
	}
	if u.PromptTokens != 500 {
		t.Fatalf("input lost (overwrite bug #15): got %d want 500", u.PromptTokens)
	}
	if u.CompletionTokens != 222 {
		t.Fatalf("output: got %d want 222", u.CompletionTokens)
	}
	if u.CacheCreationTokens != 20000 || u.CacheReadTokens != 300000 {
		t.Fatalf("cache: creation=%d read=%d, want 20000/300000", u.CacheCreationTokens, u.CacheReadTokens)
	}
}
