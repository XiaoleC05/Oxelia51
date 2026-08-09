package adapter

import (
	"strings"
	"testing"
)

// TestResolveTargetIdempotent 锁住路径前缀幂等：客户端无论是否带 /v1，
// 上游都只收到一份 pathPrefix（#3：双 /v1 修复回归）。
func TestResolveTargetIdempotent(t *testing.T) {
	reg := NewRegistry()
	cases := []struct {
		name   string
		path   string // 完整代理路径
		prefix string // 命中的路由前缀
		want   string // ResolveTarget 返回（forward.go 会再拼 route.PathPrefix）
	}{
		// openai: pathPrefix=/v1
		{"openai 已带 v1", "/api/proxy/openai/v1/chat/completions", "/api/proxy/openai/", "chat/completions"},
		{"openai 未带 v1", "/api/proxy/openai/chat/completions", "/api/proxy/openai/", "chat/completions"},
		{"openai 仅 v1", "/api/proxy/openai/v1", "/api/proxy/openai/", ""},

		// anthropic: pathPrefix="" —— /v1/messages 必须原样保留
		{"anthropic v1/messages", "/api/proxy/anthropic/v1/messages", "/api/proxy/anthropic/", "v1/messages"},
		{"anthropic messages", "/api/proxy/anthropic/messages", "/api/proxy/anthropic/", "messages"},

		// qwen: pathPrefix=/compatible-mode/v1
		{"qwen 已带 v1", "/api/proxy/qwen/v1/chat/completions", "/api/proxy/qwen/", "chat/completions"},
		{"qwen 未带", "/api/proxy/qwen/chat/completions", "/api/proxy/qwen/", "chat/completions"},

		// deepseek: pathPrefix=/v1
		{"deepseek 已带 v1", "/api/proxy/deepseek/v1/chat/completions", "/api/proxy/deepseek/", "chat/completions"},
		{"deepseek 未带", "/api/proxy/deepseek/chat/completions", "/api/proxy/deepseek/", "chat/completions"},

		// gemini: pathPrefix=/v1beta/openai
		{"gemini 已带 v1beta", "/api/proxy/gemini/v1beta/openai/chat/completions", "/api/proxy/gemini/", "chat/completions"},
		{"gemini 未带", "/api/proxy/gemini/chat/completions", "/api/proxy/gemini/", "chat/completions"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			// 先确认路由能命中
			route, hit := reg.Match(c.path)
			if route == nil {
				t.Fatalf("Match miss for %s", c.path)
			}
			_ = hit
			got := reg.ResolveTarget(c.path, c.prefix)
			if got != c.want {
				t.Fatalf("ResolveTarget(%q) = %q, want %q", c.path, got, c.want)
			}
			// 最终拼出的上游路径必须只含一份 pathPrefix
			pp := strings.TrimPrefix(route.PathPrefix, "/")
			var full string
			if pp == "" {
				full = "/" + got
			} else if got == "" {
				full = "/" + pp
			} else {
				full = "/" + pp + "/" + got
			}
			// 期望：拼好后不再出现 pathPrefix 重复（如 /v1/v1）
			if pp != "" && strings.Contains(full, "/"+pp+"/"+pp) {
				t.Fatalf("upstream path 重复前缀: %q", full)
			}
		})
	}
}
