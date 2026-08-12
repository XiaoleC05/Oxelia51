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
	// DeepSeek 官方 Anthropic 兼容端点（/anthropic/v1/messages）：供 Claude Code 等
	// Anthropic 协议客户端经本地代理记账使用（纯透传，上游协议与客户端一致）。
	{"deepseek-anthropic", "deepseek", "api.deepseek.com", "/anthropic", true},
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
	{"kimi-for-coding", "kimi-for-coding", "api.kimi.com", "/coding/v1", true},
	{"baidu-qianfan", "baidu-qianfan", "qianfan.baidubce.com", "/v2", false},

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
	{"minimax-io", "minimax-io", "api.minimax.io", "/v1", false},
	{"zai", "zai", "api.z.ai", "/api/paas/v4", false},
	{"stepfun-ai", "stepfun-ai", "api.stepfun.ai", "/v1", false},

	// ---- 第三方平台（中转/聚合站，按各官方文档核实接入）----
	// 注意前缀差异：胜算云 /api/v1、StreamLake /api/gateway/coding/v1、
	// OpenCode /zen/v1、LongCat /openai；apito/claudecn 走 Anthropic 协议
	// 根域（SDK 自补 /v1/messages），a6api 官方 base 即根域（/v1 仍兼容）。
	{"packyapi", "packyapi", "www.packyapi.ai", "/v1", false},
	{"zetaapi", "zetaapi", "api.zetaapi.ai", "/v1", false},
	{"apinebula", "apinebula", "api.apinebula.ai", "/v1", false},
	{"pateway", "pateway", "api.pateway.ai", "/v1", false},
	{"fenno", "fenno", "api.fenno.ai", "/v1", false},
	{"runapi", "runapi", "runapi.ai", "/v1", false},
	{"shengsuanyun", "shengsuanyun", "router.shengsuanyun.com", "/api/v1", false},
	{"aigocode", "aigocode", "api.aigocode.app", "/v1", false},
	{"aicoding", "aicoding", "api.aicoding.inc", "/v1", false},
	{"subrouter", "subrouter", "subrouter.ai", "/v1", false},
	{"apikeyfun", "apikeyfun", "api.apikey.fun", "/v1", false},
	{"apito", "apito", "gw.apito.ai", "", true},
	{"code0", "code0", "code0.ai", "/v1", false},
	{"teamorouter", "teamorouter", "api.teamorouter.com", "/v1", false},
	{"claudecn", "claudecn", "claudecn.ai", "", true},
	{"a6api", "a6api", "a6api.com", "", false},
	{"atlascloud", "atlascloud", "api.atlascloud.ai", "/v1", false},
	{"compshare", "compshare", "api.modelverse.cn", "/v1", false},
	{"ccsub", "ccsub", "www.ccsub.net", "/v1", false},
	{"micuapi", "micuapi", "www.micuapi.ai", "/v1", false},
	{"rightapi", "rightapi", "api.rightapi.ai", "/v1", false},
	{"cubence", "cubence", "api.cubence.com", "/v1", false},
	{"crazyrouter", "crazyrouter", "crazyrouter.com", "/v1", false},
	{"dmxapi", "dmxapi", "www.dmxapi.cn", "/v1", false},
	{"aihubmix", "aihubmix", "aihubmix.com", "/v1", false},
	{"cherryin", "cherryin", "open.cherryin.ai", "/v1", false},
	{"eflowcode", "eflowcode", "e-flowcode.cc", "/v1", false},
	{"streamlake", "streamlake", "wanqing.streamlakeapi.com", "/api/gateway/coding/v1", false},
	{"longcat", "longcat", "api.longcat.chat", "/openai", false},
	{"opencode", "opencode", "opencode.ai", "/zen/v1", false},
	{"pipellm", "pipellm", "api.pipellm.ai", "/v1", false},
	{"relaxycode", "relaxycode", "api.relaxycode.com", "/v1", false},
	{"therouter", "therouter", "api.therouter.ai", "/v1", false},
}

// CustomSource 返回当前生效的自定义供应商列表（由 localapi 实现，带短 TTL 缓存，
// Match 热路径不直接打 SQL）。nil 或未设置时行为与纯静态表一致。
type CustomSource func() []CustomProvider

// anthropicEndpoints 声明内置供应商的 Anthropic 协议端点（供 Claude Code 等客户端）。
// key = 基础 slug（如 deepseek）；value 为 Anthropic 端点的 (host, pathPrefix)。
// NewRegistry 会为每个条目自动合成一条 "/api/proxy/<slug>/anthropic/" 路由——
// Claude Code 只需把 base URL 指到该后缀即可，无需另建独立 slug（原 deepseek-anthropic
// 独立行保留向后兼容，后续可收敛为通用后缀）。
// 注意：上游为「Anthropic 协议根域」的供应商（anthropic / apito / claudecn 等）
// 已按 anthropic=true 注册，直接走基础 slug，无需此处声明。
var anthropicEndpoints = map[string]struct {
	host, pathPrefix string
}{
	"deepseek": {"api.deepseek.com", "/anthropic"},     // 官方 Anthropic 兼容端点（官方文档确认）
	"zhipu":    {"open.bigmodel.cn", "/api/anthropic"}, // 智谱 GLM Claude Code 兼容端点（官方文档确认）
}

// Registry 管理路由映射表
type Registry struct {
	routes    map[string]Route
	customSrc CustomSource // 自定义供应商回退源（静态表查无后按 slug 解析）
}

// NewRegistry 创建默认路由注册表
func NewRegistry() *Registry {
	routes := make(map[string]Route, len(providerSpecs)+len(anthropicEndpoints))
	for _, p := range providerSpecs {
		var ad Adapter
		if p.anthropic {
			ad = NewAnthropicAdapter(p.name)
		} else {
			ad = NewOpenAIAdapter(p.name)
		}
		routes["/api/proxy/"+p.slug+"/"] = Route{
			Adapter:     ad,
			Target:      p.host,
			PathPrefix:  p.pathPrefix,
			XAPIKeyAuth: p.anthropic && p.name != "kimi-for-coding", // 见 Route.XAPIKeyAuth
		}
	}
	// 为声明了 Anthropic 端点的供应商合成 "/api/proxy/<slug>/anthropic/" 变体路由：
	// Claude Code 等 Anthropic 协议客户端把 base URL 指到该后缀即可（无需另建 slug）。
	// 最长前缀匹配保证普通 OpenAI 流量仍命中基础路由（registry.go Match）。
	for slug, ep := range anthropicEndpoints {
		routes["/api/proxy/"+slug+"/anthropic/"] = Route{
			Adapter:     NewAnthropicAdapter(slug),
			Target:      ep.host,
			PathPrefix:  ep.pathPrefix,
			XAPIKeyAuth: true, // Anthropic 协议 → 上游用 x-api-key
		}
	}
	return &Registry{routes: routes}
}

// SetCustomSource 挂自定义供应商回退源（main 在本地模式接线）。
func (r *Registry) SetCustomSource(src CustomSource) {
	r.customSrc = src
}

// matchCustom 在自定义供应商中按前缀匹配（slug 唯一，前缀即命中）。
func (r *Registry) matchCustom(path string) (*Route, string) {
	if r.customSrc == nil {
		return nil, ""
	}
	for _, p := range r.customSrc() {
		route, prefix, err := p.route()
		if err == nil && strings.HasPrefix(path, prefix) {
			return &route, prefix
		}
	}
	return nil, ""
}

// Match 返回最长前缀匹配的 Route，未匹配返回 nil。
// 静态表查无后回退自定义供应商（以 settings 当前值为准，经 CustomSource 缓存）。
func (r *Registry) Match(path string) (*Route, string) {
	bestPrefix := ""
	for prefix := range r.routes {
		if strings.HasPrefix(path, prefix) && len(prefix) > len(bestPrefix) {
			bestPrefix = prefix
		}
	}
	if bestPrefix != "" {
		route := r.routes[bestPrefix]
		return &route, bestPrefix
	}
	return r.matchCustom(path)
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
		// 自定义供应商：前缀不在静态表，按 slug 回退解析（pathPrefix 去重同内置）
		if cr, cp := r.matchCustom(prefix); cr != nil && cp == prefix {
			route, ok = *cr, true
		}
	}
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

// BuiltinProviders 返回全部内置供应商 slug（含零用量路由）。
// /api/providers 全量化用：UI 交叉核验「已接入」依赖完整列表，
// 只看用量聚合会把没用过的内置路由误标「未接入」。
func BuiltinProviders() []string {
	slugs := make([]string, 0, len(providerSpecs))
	for _, p := range providerSpecs {
		slugs = append(slugs, p.slug)
	}
	return slugs
}
