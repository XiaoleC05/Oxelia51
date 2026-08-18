package localapi

import (
	"encoding/json"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ModelPrice 单模型定价（USD / 每 1M tokens）。
type ModelPrice struct {
	Prompt     float64 `json:"prompt"`
	Completion float64 `json:"completion"`
}

// 默认定价表（USD/1M tokens，近似公开价，可在设置页修改）。
// 缺失模型按 0 成本计，不虚构。
//
// #25：与 analytics/deploy/migrations/003_model_pricing_seed.sql（云端成本基准）
// 的共有模型价格保持一致，避免桌面「一键填入」参考价与云端实际成本口径不同。
// 共有模型价格有 TestDefaultPricingMatchesSeed 防漂移。
var defaultPricing = map[string]ModelPrice{
	// Anthropic（现行五代）
	"claude-fable-5":     {Prompt: 10.0, Completion: 50.0},
	"claude-opus-5":      {Prompt: 5.0, Completion: 25.0},
	"claude-sonnet-5":    {Prompt: 3.0, Completion: 15.0},
	// 模型 ID 用连字符（claude-haiku-4-5）而非点号——与 Anthropic 官方 API 模型 ID
	// 及云端 seed 一致；此前点号写法匹配不上真实请求的模型名，该模型成本恒为「未配置定价」。
	"claude-haiku-4-5":   {Prompt: 1.0, Completion: 5.0},
	// Claude 4.x（稳定版，官方价同五代对应档位）
	"claude-opus-4-6":    {Prompt: 5.0, Completion: 25.0},
	"claude-opus-4-7":    {Prompt: 5.0, Completion: 25.0},
	"claude-opus-4-8":    {Prompt: 5.0, Completion: 25.0},
	"claude-sonnet-4-6":  {Prompt: 3.0, Completion: 15.0},
	// OpenAI（现行 5.6 家族 + 通用档）
	"gpt-5.6-sol":        {Prompt: 5.0, Completion: 30.0},
	"gpt-5.6-terra":      {Prompt: 2.0, Completion: 12.0},
	"gpt-5.6-luna":       {Prompt: 0.2, Completion: 1.2},
	"gpt-5.5":            {Prompt: 5.0, Completion: 30.0},
	"gpt-5":              {Prompt: 1.25, Completion: 10.0},
	"gpt-5-mini":         {Prompt: 0.25, Completion: 2.0},
	"gpt-4o":             {Prompt: 2.5, Completion: 10.0},
	"o3":                 {Prompt: 10.0, Completion: 40.0},
	"o4-mini":            {Prompt: 1.1, Completion: 4.4},
	// DeepSeek（现行 v4 系列；deepseek-chat/reasoner 为 v4-flash 别名）
	"deepseek-v4-pro":    {Prompt: 0.42, Completion: 0.83},
	"deepseek-v4-flash":  {Prompt: 0.14, Completion: 0.28},
	"deepseek-chat":      {Prompt: 0.14, Completion: 0.28},
	"deepseek-reasoner":  {Prompt: 0.14, Completion: 0.28},
	// Kimi / Moonshot
	"kimi-k3":            {Prompt: 2.78, Completion: 13.89},
	"kimi-k2.6":          {Prompt: 0.95, Completion: 4.0},
	"kimi-k2":            {Prompt: 0.6, Completion: 2.4},
	// moonshot-v1-8k：官方 ¥2.00/¥10.00 每 1M tokens（platform.kimi.com/docs/pricing/chat-v1），÷7.2 折算
	"moonshot-v1-8k":     {Prompt: 0.28, Completion: 1.39},
	// 智谱
	"glm-5.2":            {Prompt: 1.11, Completion: 3.89},
	"glm-4":              {Prompt: 0.2, Completion: 0.6},
	// 通义千问
	"qwen3.8max":         {Prompt: 1.67, Completion: 5.0},
	"qwen3.5-plus":       {Prompt: 0.11, Completion: 0.67},
	"qwen-max":           {Prompt: 1.6, Completion: 6.4},
	// 豆包 / 火山方舟
	"doubao-seed-2.1-pro":   {Prompt: 0.83, Completion: 4.17},
	"doubao-seed-2.1-turbo": {Prompt: 0.42, Completion: 2.08},
	"doubao-pro-32k":        {Prompt: 0.11, Completion: 0.28},
	// 腾讯混元（Hy3 现行旗舰，2026-07 发布；官方 ¥1/¥4 每 1M ÷7.2）
	"hunyuan-hy3":           {Prompt: 0.14, Completion: 0.56},
	// Gemini
	"gemini-3-pro":       {Prompt: 1.5, Completion: 9.0},
	"gemini-3-flash":     {Prompt: 1.5, Completion: 7.5},
	"gemini-2.5-pro":     {Prompt: 1.25, Completion: 10.0},
	// xAI / Mistral
	"grok-4.5":           {Prompt: 2.0, Completion: 6.0},
	"mistral-large-3":    {Prompt: 0.5, Completion: 1.5},
}

// CatalogItem 模型价格目录（供价格表展示）。Provider 为供应商标签，价格 USD/1M tokens。
type CatalogItem struct {
	Model      string  `json:"model"`
	Provider   string  `json:"provider"`
	Prompt     float64 `json:"prompt"`
	Completion float64 `json:"completion"`
}

// pricingCatalog 内置常见模型参考价（按供应商归类，近似公开价，可在设置页修改）。
// 用于「模型价格表」按价格/性价比排行；桌面离线可用，标注为参考价而非实时。
// 数据按 2026-08 各厂商现行公开价整理（美元 / 每 1M tokens；国内按人民币官方价 ÷7.2 折算，
// 展示时由 /api/pricing/rate 的每日汇率换算回人民币）。
var pricingCatalog = []CatalogItem{
	// Claude / Anthropic（现行五代：Fable / Opus 5 / Sonnet 5 / Haiku 4.5）
	{"claude-fable-5", "Anthropic", 10.0, 50.0},
	{"claude-opus-5", "Anthropic", 5.0, 25.0},
	{"claude-sonnet-5", "Anthropic", 3.0, 15.0},
	{"claude-haiku-4-5", "Anthropic", 1.0, 5.0},
	// Claude 4.x（稳定版，官方价同五代对应档位）
	{"claude-opus-4-6", "Anthropic", 5.0, 25.0},
	{"claude-opus-4-7", "Anthropic", 5.0, 25.0},
	{"claude-opus-4-8", "Anthropic", 5.0, 25.0},
	{"claude-sonnet-4-6", "Anthropic", 3.0, 15.0},
	// OpenAI（现行 5.6 家族，2026-07 GA）
	{"gpt-5.6-sol", "OpenAI", 5.0, 30.0},
	{"gpt-5.6-terra", "OpenAI", 2.0, 12.0},
	{"gpt-5.6-luna", "OpenAI", 0.2, 1.2},
	{"gpt-5.5", "OpenAI", 5.0, 30.0},
	{"gpt-5.5-pro", "OpenAI", 30.0, 180.0},
	{"gpt-5.4-mini", "OpenAI", 0.75, 4.5},
	{"gpt-5.4-nano", "OpenAI", 0.2, 1.25},
	{"gpt-5", "OpenAI", 1.25, 10.0},
	{"gpt-5-mini", "OpenAI", 0.25, 2.0},
	{"o3", "OpenAI", 10.0, 40.0},
	{"o4-mini", "OpenAI", 1.1, 4.4},
	// DeepSeek（现行 v4 系列，2026-07）
	{"deepseek-v4-pro", "DeepSeek", 0.42, 0.83},
	{"deepseek-v4-flash", "DeepSeek", 0.14, 0.28},
	// Moonshot / Kimi（现行 K2.x / K3）
	{"kimi-k3", "Kimi", 2.78, 13.89},
	{"kimi-k2.6", "Kimi", 0.95, 4.0},
	{"kimi-k2.7-code", "Kimi", 0.95, 4.0},
	{"kimi-k2.5", "Kimi", 0.6, 3.0},
	{"kimi-k2", "Kimi", 0.6, 2.4},
	// moonshot-v1 经典系列（官方 ¥10/¥30 每 1M，÷7.2；官方公告 2026-08-31 全平台下线）
	{"moonshot-v1-128k", "Kimi", 1.39, 4.17},
	// 智谱 GLM（现行 5.x）
	{"glm-5.2", "智谱 GLM", 1.11, 3.89},
	{"glm-5", "智谱 GLM", 0.56, 2.5},
	{"glm-5-code", "智谱 GLM", 0.83, 3.89},
	{"glm-4.6", "智谱 GLM", 0.55, 2.1},
	{"glm-4.5-air", "智谱 GLM", 0.13, 0.85},
	// 通义千问（现行 Qwen3.7/3.8）
	{"qwen3.8max", "通义千问", 1.67, 5.0},
	{"qwen3.7plus", "通义千问", 0.28, 1.11},
	{"qwen3.5-plus", "通义千问", 0.11, 0.67},
	{"qwen3-max", "通义千问", 0.35, 1.39},
	{"qwen3-235b-a22b", "通义千问", 0.56, 1.67},
	{"qwen3-32b", "通义千问", 0.28, 1.11},
	{"qwen-long", "通义千问", 0.07, 0.28},
	{"qwen-plus", "通义千问", 0.11, 0.28},
	// 豆包 / 火山方舟（现行 seed-2.x）
	{"doubao-seed-2.1-pro", "火山方舟", 0.83, 4.17},
	{"doubao-seed-2.1-turbo", "火山方舟", 0.42, 2.08},
	{"doubao-seed-2.0-mini", "火山方舟", 0.03, 0.28},
	{"doubao-seed-1.6", "火山方舟", 0.11, 1.11},
	{"doubao-pro-32k", "火山方舟", 0.11, 0.28},
	// 腾讯混元（Hy3 现行旗舰，2026-07 发布；官方 ¥1/¥4 每 1M ÷7.2）
	{"hunyuan-hy3", "腾讯混元", 0.14, 0.56},
	// MiniMax
	{"minimax-text-01", "MiniMax", 0.14, 1.11},
	{"minimax-m1", "MiniMax", 0.11, 1.11},
	// 讯飞星火：spark-4.0-ultra 官方为分档套餐价（2026-08 核查 0.5~0.7 元/万 tokens，
	// 随套餐浮动且含限时折扣），无法确定单一官方价，按「不虚构」原则不收录，留「未配置定价」。
	// 阶跃星辰（现行 step-3.x / step-2）
	{"step-3.5-flash", "阶跃星辰", 0.1, 0.29},
	{"step-2-mini", "阶跃星辰", 0.14, 0.28},
	{"step-2-16k", "阶跃星辰", 5.28, 16.67},
	// 百川
	{"baichuan4-air", "百川", 0.14, 0.14},
	{"baichuan4-turbo", "百川", 2.08, 2.08},
	// Google Gemini（现行 Gemini 3.x / 2.5）
	{"gemini-3-pro", "Google Gemini", 1.5, 9.0},
	{"gemini-3-flash", "Google Gemini", 1.5, 7.5},
	{"gemini-2.5-pro", "Google Gemini", 1.25, 10.0},
	{"gemini-2.5-flash", "Google Gemini", 0.3, 2.5},
	{"gemini-2.5-flash-lite", "Google Gemini", 0.1, 0.4},
	// xAI Grok（现行 4.5 / 4.3）
	{"grok-4.5", "xAI", 2.0, 6.0},
	{"grok-4.3", "xAI", 1.25, 2.5},
	// Mistral
	{"mistral-large-3", "Mistral", 0.5, 1.5},
	{"mistral-medium-3", "Mistral", 0.4, 2.0},
	{"mistral-small-4", "Mistral", 0.15, 0.6},
	{"mistral-small-3.2", "Mistral", 0.06, 0.18},
	{"codestral", "Mistral", 0.3, 0.9},
	// Mistral 推理模型（官方 API 价，USD）
	{"magistral-medium", "Mistral", 2.0, 5.0},
	{"magistral-small", "Mistral", 0.5, 1.5},
	// Meta Llama（开源，按主流托管商参考价）
	{"llama-4-maverick-17b-128e", "Meta / 开源", 0.15, 0.6},
	{"llama-4-scout-17b-16e", "Meta / 开源", 0.08, 0.3},
	// Groq 托管
	{"llama-3.3-70b-versatile", "Groq", 0.59, 0.79},
	{"llama-3.1-8b-instant", "Groq", 0.05, 0.08},
	{"llama-4-scout-17b-16e-instruct", "Groq", 0.11, 0.34},
	// Perplexity Sonar
	{"sonar-pro", "Perplexity", 3.0, 15.0},
	{"sonar", "Perplexity", 1.0, 1.0},
	{"sonar-reasoning-pro", "Perplexity", 2.0, 8.0},
	// Cohere
	{"command-a", "Cohere", 2.5, 10.0},
	{"command-r", "Cohere", 0.15, 0.6},
}

// Settings 本地设置（存 settings 表，key→value JSON）。
//
// 注：不含 port —— sidecar 端口由 Tauri 壳硬编码 17800（lib.rs），
// 且 port 不在 allowedSettingKeys 白名单内，前端零引用。原字段为死代码（#30）。
type Settings struct {
	Theme        string       `json:"theme"`
	Pricing      []PricedItem `json:"pricing"`
	Budgets      []BudgetItem `json:"budgets"`
	Sync         SyncConfig   `json:"sync"`
	WidgetFields  []string   `json:"widgetFields"`        // 悬浮卡片显示字段（空 = 全部）
	WidgetPos     *WidgetPos `json:"widgetPos,omitempty"` // 悬浮卡片窗口位置（持久化）
	// AgentAliases Agent 显示名别名（原始名 → 自定义名；如把「其他」重命名），#问题 4。
	// 仅返回，不参与 Settings 写入白名单（写入走 agent_aliases key 单独校验 JSON）。
	AgentAliases map[string]string `json:"agentAliases,omitempty"`
}

// WidgetPos 悬浮卡片窗口位置（主窗口拖动后保存，重启恢复）。
type WidgetPos struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// PricedItem 定价表中的一行（前端可编辑）。
type PricedItem struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt"` // 前端展示用字符串
	Completion string `json:"completion"`
}

// BudgetItem 预算阈值。dimension ∈ {global, provider, agent, model}，
// global 时 target 为空；其余维度 target 为具体名称（如 provider=deepseek、agent=cursor、model=gpt-5）。
type BudgetItem struct {
	Dimension   string `json:"dimension"`             // global / provider / agent / model
	Target      string `json:"target,omitempty"`      // 具体名称（global 为空）
	Model       string `json:"model,omitempty"`       // 兼容旧格式：dimension=model 时等价于 target
	DailyTokens int64  `json:"dailyTokens"`
}

// SyncConfig 多设备同步配置（P4）。
type SyncConfig struct {
	Enabled bool   `json:"enabled"`
	Account string `json:"account"`
	// LastSync 上次同步成功时间（sync_last，RFC3339），仅展示用。
	// 同步游标另存 sync_up_ts（上传）/ sync_dl_seq（下载），见 sync.go。
	LastSync string `json:"lastSync"`
}

func (a *API) getSetting(key string) string {
	var v string
	err := a.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&v)
	if err != nil {
		return ""
	}
	return v
}

// setSetting 写入 settings 表；写库失败返回 error（调用方必须处理，
// HTTP 层映射 500），不再静默吞掉（否则设置页显示保存成功实则未落库）。
func (a *API) setSetting(key, value string) error {
	// #26：定价变更时主动失效缓存，成本立即按新价算（不等 TTL 到期）
	if key == "pricing" {
		a.pmu.Lock()
		a.pricingCached = nil
		a.pmu.Unlock()
	}
	// 自定义供应商写入后 Match 立即可见（不等 TTL）
	if key == customProvidersKey {
		a.invalidateCustomProviders()
	}
	_, err := a.db.Exec(
		"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		key, value,
	)
	return err
}

// pricingCacheTTL 定价缓存有效期（#26）。UI 轮询 5s，此值保证保存定价后
// 最迟 5s 成本刷新；设置变更另有 setSetting 主动失效。
const pricingCacheTTL = 5 * time.Second

// getPricingMap 返回 model → ModelPrice 的定价映射（仅用户已保存的定价）。
// 全新安装为空表（UI Polish v1：不虚构模型名/价目）；未配置的模型成本按 0 计。
// 缓存：调用方只读不修改返回的 map，可安全共享。
func (a *API) getPricingMap() map[string]ModelPrice {
	a.pmu.Lock()
	defer a.pmu.Unlock()

	if a.pricingCached != nil && time.Since(a.pricingCachedAt) < pricingCacheTTL {
		return a.pricingCached
	}

	m := make(map[string]ModelPrice)
	raw := a.getSetting("pricing")
	if raw == "" {
		a.pricingCached = m
		a.pricingCachedAt = time.Now()
		return m
	}
	var items []PricedItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		log.Printf("settings pricing parse failed: %v", err)
		a.pricingCached = m
		a.pricingCachedAt = time.Now()
		return m
	}
	for _, it := range items {
		p, c := parseFloat(it.Prompt), parseFloat(it.Completion)
		if p >= 0 && c >= 0 {
			m[it.Model] = ModelPrice{Prompt: p, Completion: c}
		}
	}
	a.pricingCached = m
	a.pricingCachedAt = time.Now()
	return m
}

// defaultPricingList 返回内置常见模型参考价（供设置页「一键填入」；默认不展示、不参与成本）。
func (a *API) defaultPricingList() []PricedItem {
	models := make([]string, 0, len(defaultPricing))
	for m := range defaultPricing {
		models = append(models, m)
	}
	sort.Strings(models)
	items := make([]PricedItem, 0, len(models))
	for _, m := range models {
		p := defaultPricing[m]
		items = append(items, PricedItem{Model: m, Prompt: f2s(p.Prompt), Completion: f2s(p.Completion)})
	}
	return items
}

func parseFloat(s string) float64 {
	if s == "" {
		return -1
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return -1
	}
	return f
}

// costOf 计算一条记录的 USD 成本。
// 定价优先级：用户保存的定价（settings.pricing）优先；缺失时回退到内置参考价
// defaultPricing（#问题 3：参考列表已收录的模型不再按 0 计 → 总览/明细显示「未配置定价」）。
// 模型名带上下文窗口后缀（如 Claude Code 的 deepseek-v4-pro[1M]）时剥离后缀再查，
// 使 [1M]/[2M] 变体也能命中参考价。defaultPricing 也未收录的模型按 0 计（不虚构）。
func costOf(pricing map[string]ModelPrice, model string, prompt, completion int64) float64 {
	p, ok := pricing[model]
	if !ok {
		if ref, ok := lookupDefaultPricing(model); ok {
			p = ref
		} else {
			return 0
		}
	}
	return float64(prompt)/1e6*p.Prompt + float64(completion)/1e6*p.Completion
}

// lookupDefaultPricing 在内置参考价表中查询模型，带上下文窗口后缀（[1M]/[2M]/[32k]…）
// 时先剥离后缀再查（如 deepseek-v4-pro[1M] → deepseek-v4-pro）。
func lookupDefaultPricing(model string) (ModelPrice, bool) {
	if ref, ok := defaultPricing[model]; ok {
		return ref, true
	}
	// 剥离 [..] 上下文后缀：模型名 + [Nk|Nk] 结尾（Claude Code / 部分客户端命名约定）
	if i := strings.Index(model, "["); i > 0 {
		if ref, ok := defaultPricing[model[:i]]; ok {
			return ref, true
		}
	}
	return ModelPrice{}, false
}

// getBudgets 返回预算列表（settings.budgets）。
func (a *API) getBudgets() []BudgetItem {
	raw := a.getSetting("budgets")
	if raw == "" {
		return nil
	}
	var items []BudgetItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		log.Printf("settings budgets parse failed: %v", err)
		return nil
	}
	return items
}

// getWidgetFields 读取悬浮卡片显示字段（JSON 字符串数组）；未设置返回 nil = 全部。
func (a *API) getWidgetFields() []string {
	raw := a.getSetting("widget_fields")
	if raw == "" {
		return nil
	}
	var f []string
	if json.Unmarshal([]byte(raw), &f) == nil {
		return f
	}
	return nil
}

// getWidgetPos 读取悬浮卡片窗口位置；未设置返回 nil。
func (a *API) getWidgetPos() *WidgetPos {
	raw := a.getSetting("widget_pos")
	if raw == "" {
		return nil
	}
	var p WidgetPos
	if json.Unmarshal([]byte(raw), &p) == nil {
		return &p
	}
	return nil
}

// loadSettings 读取全部设置（主题/定价/预算/同步/悬浮卡片字段与位置）。
func (a *API) loadSettings() Settings {
	theme := a.getSetting("theme")
	if theme == "" {
		theme = "cosmos"
	}
	var items []PricedItem
	raw := a.getSetting("pricing")
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &items)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Model < items[j].Model })
	sync := SyncConfig{Enabled: a.getSetting("sync_enabled") == "true", Account: a.getSetting("sync_account"), LastSync: a.getSetting("sync_last")}
	return Settings{Theme: theme, Pricing: items, Budgets: a.getBudgets(), Sync: sync, WidgetFields: a.getWidgetFields(), WidgetPos: a.getWidgetPos(), AgentAliases: a.getAgentAliases()}
}
