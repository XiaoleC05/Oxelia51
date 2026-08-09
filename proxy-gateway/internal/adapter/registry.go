package adapter

import (
	"strings"
)

// providerSpec 声明一个 LLM 供应商的代理配置。
// 新增供应商只需在 providerSpecs 加一行数据，无需改路由逻辑。
type providerSpec struct {
	slug       string // 代理路径：/api/proxy/<slug>/
	name       string // 供应商标识（写入 token_events.provider）
	host       string // 上游主机
	pathPrefix string // 上游路径前缀（如 /v1、/compatible-mode/v1）
	anthropic  bool   // true 使用 Anthropic 协议适配器，否则 OpenAI 兼容协议
}

// providerSpecs 主流 LLM 供应商路由表（OpenAI 兼容协议为主）。
// 注意：pathPrefix 是上游 API 的路径前缀，不是代理路径的一部分。
var providerSpecs = []providerSpec{
	// ---- 国内可直接访问 ----
	{"deepseek", "deepseek", "api.deepseek.com", "/v1", false},
	{"moonshot", "moonshot", "api.moonshot.cn", "/v1", false},
	{"zhipu", "zhipu", "open.bigmodel.cn", "/api/paas/v4", false},
	{"qwen", "qwen", "dashscope.aliyuncs.com", "/compatible-mode/v1", false},
	{"doubao", "doubao", "ark.cn-beijing.volces.com", "/api/v3", false},
	{"hunyuan", "hunyuan", "api.hunyuan.cloud.tencent.com", "/v1", false},
	{"spark", "spark", "spark-api-open.xf-yun.com", "/v1", false},
	{"minimax", "minimax", "api.minimax.chat", "/v1", false},
	{"baichuan", "baichuan", "api.baichuan-ai.com", "/v1", false},
	{"yi", "yi", "api.lingyiwanwu.com", "/v1", false},
	{"sensenova", "sensenova", "api.sensenova.cn", "/v1", false},
	{"stepfun", "stepfun", "api.stepfun.com", "/v1", false},
	{"siliconflow", "siliconflow", "api.siliconflow.cn", "/v1", false},
	{"ppio", "ppio", "api.ppinfra.com", "/v3/openai", false},
	{"gitee", "gitee", "ai.gitee.com", "/v1", false},
	{"modelscope", "modelscope", "api-inference.modelscope.cn", "/v1", false},

	// ---- 聚合网关（一个入口覆盖数百模型）----
	{"openrouter", "openrouter", "openrouter.ai", "/api/v1", false},
	{"together", "together", "api.together.xyz", "/v1", false},
	{"fireworks", "fireworks", "api.fireworks.ai", "/inference/v1", false},
	{"deepinfra", "deepinfra", "api.deepinfra.com", "/v1/openai", false},
	{"novita", "novita", "api.novita.ai", "/v3/openai", false},
	{"featherless", "featherless", "featherless.ai", "/v1", false},

	// ---- 国际直连（部分在中国大陆不可达，视网络环境）----
	{"openai", "openai", "api.openai.com", "/v1", false},
	{"anthropic", "anthropic", "api.anthropic.com", "", true},
	{"gemini", "gemini", "generativelanguage.googleapis.com", "/v1beta/openai", false},
	{"mistral", "mistral", "api.mistral.ai", "/v1", false},
	{"xai", "xai", "api.x.ai", "/v1", false},
	{"groq", "groq", "api.groq.com", "/openai/v1", false},
	{"cerebras", "cerebras", "api.cerebras.ai", "/v1", false},
	{"cohere", "cohere", "api.cohere.com", "/compatibility/v1", false},
	{"perplexity", "perplexity", "api.perplexity.ai", "", false},
	{"sambanova", "sambanova", "api.sambanova.ai", "/v1", false},
	{"nebius", "nebius", "api.studio.nebius.com", "/v1", false},
	{"ai21", "ai21", "api.ai21.com", "/v1", false},
	{"hyperbolic", "hyperbolic", "api.hyperbolic.xyz", "/v1", false},
	{"friendli", "friendli", "api.friendli.ai", "/serverless/v1", false},
	{"nvidia", "nvidia", "integrate.api.nvidia.com", "/v1", false},
	{"github-models", "github-models", "models.inference.ai.azure.com", "/v1", false},
}

// Registry 管理路由映射表
type Registry struct {
	routes map[string]Route
}

// NewRegistry 创建默认路由注册表
func NewRegistry() *Registry {
	routes := make(map[string]Route, len(providerSpecs))
	for _, p := range providerSpecs {
		var ad Adapter
		if p.anthropic {
			ad = NewAnthropicAdapter(p.name)
		} else {
			ad = NewOpenAIAdapter(p.name)
		}
		routes["/api/proxy/"+p.slug+"/"] = Route{
			Adapter:    ad,
			Target:     p.host,
			PathPrefix: p.pathPrefix,
		}
	}
	return &Registry{routes: routes}
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

// ResolveTarget 将代理路径转为上游路径（含供应商路径前缀）。
// 幂等处理客户端可能重复传入的路径前缀（#3：双 /v1 修复）：
//
//	/api/proxy/openai/v1/chat/completions   → chat/completions      （客户端带 /v1，pathPrefix=/v1）
//	/api/proxy/openai/chat/completions      → chat/completions      （客户端未带）
//	/api/proxy/anthropic/v1/messages        → v1/messages           （pathPrefix 空，/v1 是真实端点，保留）
//	/api/proxy/qwen/v1/chat/completions     → chat/completions      （pathPrefix=/compatible-mode/v1，客户端只带末尾段 v1）
//	/api/proxy/qwen/compatible-mode/v1/...  → ...                   （客户端带完整 pathPrefix，同样去重）
//
// 规则：
//  1. 剥代理前缀后得 rest；若 rest 以「完整 pathPrefix」开头则去整段（覆盖客户端带完整前缀）。
//  2. 否则，若 pathPrefix 多段且末尾段形如版本号（v1 / v3 / v1beta），而 rest 恰以该段开头，
//     去掉该段（覆盖 OpenAI SDK 习惯只带 /v1，而供应商 pathPrefix 是 /compatible-mode/v1 这类）。
//     末尾段非版本号（如 gemini 的 .../openai）不去重，避免误伤。
func (r *Registry) ResolveTarget(path, prefix string) string {
	rest := strings.TrimPrefix(path, prefix)
	rest = strings.TrimPrefix(rest, "/")
	route, ok := r.routes[prefix]
	if !ok {
		return rest
	}
	pp := strings.TrimPrefix(route.PathPrefix, "/")
	if pp == "" {
		return rest
	}
	// 规则 1：完整 pathPrefix 前缀
	if rest == pp {
		return ""
	}
	if strings.HasPrefix(rest, pp+"/") {
		return strings.TrimPrefix(rest, pp+"/")
	}
	// 规则 2：多段 pathPrefix 的末尾版本段
	if idx := strings.LastIndex(pp, "/"); idx >= 0 {
		seg := pp[idx+1:]
		if looksLikeVersion(seg) {
			if rest == seg {
				return ""
			}
			if strings.HasPrefix(rest, seg+"/") {
				return strings.TrimPrefix(rest, seg+"/")
			}
		}
	}
	return rest
}

// looksLikeVersion 判断路径段是否形如版本号（v1 / v3 / v1beta / 2），
// 用于限定「末尾段去重」只对版本段生效，避免把 openai / api 这类语义段误删。
func looksLikeVersion(seg string) bool {
	if seg == "" {
		return false
	}
	if seg[0] == 'v' && len(seg) > 1 && seg[1] >= '0' && seg[1] <= '9' {
		return true
	}
	return seg[0] >= '0' && seg[0] <= '9'
}

// Providers 返回所有已注册的供应商名称
func (r *Registry) Providers() []string {
	names := make([]string, 0, len(providerSpecs))
	for _, p := range providerSpecs {
		names = append(names, p.name)
	}
	return names
}
