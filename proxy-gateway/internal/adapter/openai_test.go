package adapter

import (
	"bytes"
	"testing"
)

// TestOpenAIExtractUsageResponseAPI 锁住 Response API（/v1/responses）记账：
// usage 用 input_tokens/output_tokens，而 chat/completions 用 prompt_tokens/completion_tokens。
func TestOpenAIExtractUsageResponseAPI(t *testing.T) {
	a := NewOpenAIAdapter("openai")
	body := []byte(`{"model":"gpt-5.6-sol","usage":{
		"input_tokens":120,"output_tokens":60,"total_tokens":180,
		"input_tokens_details":{"cached_tokens":0},
		"output_tokens_details":{"reasoning_tokens":0}}}`)
	resp := newResp(body)
	u, err := a.ExtractUsage(resp)
	if err != nil || u == nil {
		t.Fatalf("ExtractUsage err=%v u=%v", err, u)
	}
	if u.PromptTokens != 120 || u.CompletionTokens != 60 {
		t.Fatalf("response api usage: in=%d out=%d, want 120/60",
			u.PromptTokens, u.CompletionTokens)
	}
}

// TestOpenAIExtractUsageChatCompletions 锁住 Chat Completions 记账不受 Response API 字段影响。
func TestOpenAIExtractUsageChatCompletions(t *testing.T) {
	a := NewOpenAIAdapter("deepseek")
	body := []byte(`{"model":"deepseek-v4-pro","usage":{"prompt_tokens":500,"completion_tokens":222,"total_tokens":722}}`)
	resp := newResp(body)
	u, err := a.ExtractUsage(resp)
	if err != nil || u == nil {
		t.Fatalf("ExtractUsage err=%v u=%v", err, u)
	}
	if u.PromptTokens != 500 || u.CompletionTokens != 222 {
		t.Fatalf("chat completions usage: in=%d out=%d, want 500/222",
			u.PromptTokens, u.CompletionTokens)
	}
}

// TestOpenAIExtractUsageFromStreamResponseAPI 锁住 Response API 流式：
// usage 嵌套在 response.usage（response.completed 事件），非顶层。
func TestOpenAIExtractUsageFromStreamResponseAPI(t *testing.T) {
	a := NewOpenAIAdapter("openai")
	sse := bytes.NewReader([]byte(
		"event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"hi\"}\n\n" +
			"event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"usage\":{\"input_tokens\":300,\"output_tokens\":150,\"total_tokens\":450}}}\n\n"))
	u, err := a.ExtractUsageFromStream(sse)
	if err != nil || u == nil {
		t.Fatalf("ExtractUsageFromStream err=%v u=%v", err, u)
	}
	if u.PromptTokens != 300 || u.CompletionTokens != 150 {
		t.Fatalf("response api stream usage: in=%d out=%d, want 300/150",
			u.PromptTokens, u.CompletionTokens)
	}
}
