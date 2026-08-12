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

		// deepseek-anthropic: pathPrefix=/anthropic —— Claude Code 发 /v1/messages
		// 必须原样保留（v1 不是 pathPrefix 的版本段，不走规则 2 去重）
		{"deepseek-anthropic v1/messages", "/api/proxy/deepseek-anthropic/v1/messages", "/api/proxy/deepseek-anthropic/", "v1/messages"},
		{"deepseek-anthropic messages", "/api/proxy/deepseek-anthropic/messages", "/api/proxy/deepseek-anthropic/", "messages"},

		// 合成 anthropic 变体路由：/api/proxy/<slug>/anthropic/ —— 与独立 deepseek-anthropic 行并存，
		// Claude Code 对任意声明了 Anthropic 端点的 provider 都能用统一后缀（#anthropic 路径适配）
		{"deepseek anthropic v1/messages", "/api/proxy/deepseek/anthropic/v1/messages", "/api/proxy/deepseek/anthropic/", "v1/messages"},
		{"deepseek anthropic messages", "/api/proxy/deepseek/anthropic/messages", "/api/proxy/deepseek/anthropic/", "messages"},
		{"zhipu anthropic v1/messages", "/api/proxy/zhipu/anthropic/v1/messages", "/api/proxy/zhipu/anthropic/", "v1/messages"},

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

// TestAnthropicVariantRoutes 锁定合成 anthropic 变体路由：匹配更长前缀、上游
// Anthropic 端点、x-api-key 鉴权；且普通 OpenAI 流量仍命中基础路由不受影响。
func TestAnthropicVariantRoutes(t *testing.T) {
	reg := NewRegistry()

	// Claude Code → /api/proxy/deepseek/anthropic/v1/messages 应命中合成变体
	route, prefix := reg.Match("/api/proxy/deepseek/anthropic/v1/messages")
	if route == nil {
		t.Fatal("deepseek anthropic variant route not found")
	}
	if prefix != "/api/proxy/deepseek/anthropic/" {
		t.Fatalf("matched prefix = %q, want %q", prefix, "/api/proxy/deepseek/anthropic/")
	}
	if route.Target != "api.deepseek.com" {
		t.Fatalf("target = %q, want api.deepseek.com", route.Target)
	}
	if route.PathPrefix != "/anthropic" {
		t.Fatalf("pathPrefix = %q, want /anthropic", route.PathPrefix)
	}
	if !route.XAPIKeyAuth {
		t.Fatal("anthropic variant must use x-api-key auth (XAPIKeyAuth=true)")
	}

	// 普通 OpenAI 流量不受影响，仍命中基础 deepseek 路由
	base, basePrefix := reg.Match("/api/proxy/deepseek/v1/chat/completions")
	if base == nil || basePrefix != "/api/proxy/deepseek/" {
		t.Fatalf("base deepseek route broken: prefix=%q", basePrefix)
	}
	if base.XAPIKeyAuth {
		t.Fatal("base deepseek route must stay OpenAI Bearer auth (XAPIKeyAuth=false)")
	}

	// zhipu 合成变体
	zr, zp := reg.Match("/api/proxy/zhipu/anthropic/v1/messages")
	if zr == nil {
		t.Fatal("zhipu anthropic variant route not found")
	}
	if zr.Target != "open.bigmodel.cn" || zr.PathPrefix != "/api/anthropic" {
		t.Fatalf("zhipu variant misconfigured: target=%q prefix=%q", zr.Target, zr.PathPrefix)
	}
	if zp != "/api/proxy/zhipu/anthropic/" {
		t.Fatalf("zhipu matched prefix = %q", zp)
	}
}
