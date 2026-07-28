package adapter

import (
	"strings"
)

// Registry 管理路由映射表
type Registry struct {
	routes map[string]Route
}

// NewRegistry 创建默认路由注册表
func NewRegistry() *Registry {
	return &Registry{
		routes: map[string]Route{
			"/api/proxy/openai/": {
				Adapter: NewOpenAIAdapter("openai"),
				Target:  "api.openai.com",
			},
			"/api/proxy/deepseek/": {
				Adapter: NewOpenAIAdapter("deepseek"),
				Target:  "api.deepseek.com",
			},
			"/api/proxy/moonshot/": {
				Adapter: NewOpenAIAdapter("moonshot"),
				Target:  "api.moonshot.cn",
			},
			"/api/proxy/zhipu/": {
				Adapter: NewOpenAIAdapter("zhipu"),
				Target:  "open.bigmodel.cn",
			},
			"/api/proxy/anthropic/": {
				Adapter: NewAnthropicAdapter("anthropic"),
				Target:  "api.anthropic.com",
			},
			"/api/proxy/gemini/": {
				Adapter: NewAnthropicAdapter("gemini"),
				Target:  "generativelanguage.googleapis.com",
			},
		},
	}
}

// Match 返回最长前缀匹配的 Route，未匹配返回 nil
func (r *Registry) Match(path string) (*Route, string) {
	bestPrefix := ""
	for prefix := range r.routes {
		if strings.HasPrefix(path, prefix) && len(prefix) > len(bestPrefix) {
			bestPrefix = prefix
		}
	}
	if bestPrefix == "" {
		return nil, ""
	}
	route := r.routes[bestPrefix]
	return &route, bestPrefix
}

// ResolveTarget 将代理路径转为上游路径
// /api/proxy/openai/v1/chat/completions → /v1/chat/completions
func (r *Registry) ResolveTarget(path, prefix string) string {
	return strings.TrimPrefix(path, prefix)
}

// Providers 返回所有已注册的供应商名称
func (r *Registry) Providers() []string {
	seen := map[string]bool{}
	var names []string
	for _, route := range r.routes {
		name := route.Adapter.ProviderName()
		if !seen[name] {
			seen[name] = true
			names = append(names, name)
		}
	}
	return names
}
