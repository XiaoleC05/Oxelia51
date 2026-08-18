package localapi

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// ---------- 供应商 / Agent 维度 ----------

type dimStat struct {
	Name     string  `json:"name"`
	Tokens   int64   `json:"tokens"`
	Requests int64   `json:"requests"`
	Cost     float64 `json:"cost"`
	Models   int     `json:"models"`
	LastTs   string  `json:"lastTs"`
	Custom   bool    `json:"custom,omitempty"` // 用户自定义供应商（非内置路由）
}

// daysFilter 解析 ?days= 查询参数；未传或非法时返回空（= 全量）。
// 返回 SQL 时间过滤子句与参数。
// 口径（P2-2）：token_events.timestamp 存的是本地时间字符串（recorder timeLayout），
// 而 SQLite datetime('now',...) 默认 UTC，边界附近会多算/少算 ~8h（东八区），
// 因此必须加 'localtime' 修饰符与存储口径对齐。
func daysFilter(r *http.Request) (string, any) {
	s := strings.TrimSpace(r.URL.Query().Get("days"))
	if s == "" {
		return "", nil
	}
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return "", nil
	}
	return " AND timestamp >= datetime('now', 'localtime', ?)", "-" + strconv.Itoa(n) + " days"
}

// normalizeModelName 归一化模型名：剥离上下文窗口后缀（[1M]/[2M]/[32k]…）。
// Claude Code 等客户端会把上下文窗口写进模型名（如 deepseek-v4-flash[1M]），
// 若不归一，同一模型会在排行/明细里出现多个变体（#排行模型名不规范）。
// 对不含 [..] 的名字原样返回（provider/agent 名不受影响）。
func normalizeModelName(model string) string {
	if i := strings.Index(model, "["); i > 0 {
		return model[:i]
	}
	return model
}

// loadDimStats 按维度列（provider / agent）聚合 token 用量与成本（成本按模型定价现算）。
// 单个查询 GROUP BY (dim, model)，在 Go 内按 dim 汇总，避免主查询未关闭时嵌套查询死锁。
func (a *API) loadDimStats(dimCol string, since string, sinceArg any) []dimStat {
	pricing := a.getPricingMap()
	q := "SELECT " + dimCol + ", model, COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events WHERE " + dimCol + " != ''"
	args := []any{}
	if since != "" {
		q += since
		args = append(args, sinceArg)
	}
	q += " GROUP BY " + dimCol + ", model"
	rows, err := a.db.Query(q, args...)
	if err != nil {
		return nil
	}
	agg := map[string]*dimStat{}
	order := []string{}
	for rows.Next() {
		var dim, model string
		var p, c, t, req int64
		if rows.Scan(&dim, &model, &p, &c, &t, &req) != nil {
			continue
		}
		// 模型维度：归一化模型名（剥离 [1M] 等上下文后缀），使同一模型的不同
		// 上下文变体聚合到一条（#排行模型名不规范）。provider/agent 名无 [..] 后缀不受影响。
		if dimCol == "model" {
			dim = normalizeModelName(dim)
		}
		st := agg[dim]
		if st == nil {
			st = &dimStat{Name: dim}
			agg[dim] = st
			order = append(order, dim)
		}
		st.Tokens += t
		st.Requests += req
		st.Cost += costOf(pricing, model, p, c)
		st.Models++
	}
	rows.Close()

	// 各维度的最近时间（主查询已关闭，避免单连接嵌套查询死锁）
	lastQ := "SELECT " + dimCol + ", MAX(timestamp) FROM token_events WHERE " + dimCol + " != ''"
	lastArgs := []any{}
	if since != "" {
		lastQ += since
		lastArgs = append(lastArgs, sinceArg)
	}
	lastQ += " GROUP BY " + dimCol
	lastRows, err := a.db.Query(lastQ, lastArgs...)
	if err == nil {
		for lastRows.Next() {
			var dim, ts string
			if lastRows.Scan(&dim, &ts) == nil {
				if st := agg[dim]; st != nil {
					st.LastTs = ts
				}
			}
		}
		lastRows.Close()
	}

	out := make([]dimStat, 0, len(order))
	for _, name := range order {
		out = append(out, *agg[name])
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Tokens > out[j].Tokens })
	return out
}

// handleProviders 供应商聚合（供应商 = LLM 模型提供商）。支持 ?days=N。
// 返回与 registry 全量路由（内置 + 自定义）的左并集：零用量的内置路由以零值
// 条目追加（UI 交叉核验「已接入」依赖全量列表，只看用量会把没用过的预设误标
// 「未接入」）；自定义供应商同理，带 custom:true 标记（向后兼容新增字段）。
func (a *API) handleProviders(w http.ResponseWriter, r *http.Request) {
	since, sinceArg := daysFilter(r)
	stats := a.loadDimStats("provider", since, sinceArg)
	seen := make(map[string]bool, len(stats))
	for i := range stats {
		seen[stats[i].Name] = true
	}
	// 内置路由全量补齐：无用量的以零值条目追加在尾部（custom 标记仅自定义带）
	for _, slug := range adapter.BuiltinProviders() {
		if !seen[slug] {
			seen[slug] = true
			stats = append(stats, dimStat{Name: slug})
		}
	}
	// 自定义供应商：已有用量记录的标记之，尚无记录的以零值条目追加
	for _, p := range a.getCustomProviders() {
		if seen[p.Slug] {
			for i := range stats {
				if stats[i].Name == p.Slug {
					stats[i].Custom = true
				}
			}
		} else {
			stats = append(stats, dimStat{Name: p.Slug, Custom: true})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"providers":         stats,
		"anthropicVariants": adapter.AnthropicVariantProviders(),
	})
}

// handleModels 模型聚合（Model = LLM 模型名）。支持 ?days=N。
// 与 providers/agents 同口径，供总览「按模型」排行在日期范围切换时联动刷新。
func (a *API) handleModels(w http.ResponseWriter, r *http.Request) {
	since, sinceArg := daysFilter(r)
	// loadDimStats("model") 的 Models 字段在此语义为「每个模型自身 = 1」，前端模型排行不使用该字段。
	writeJSON(w, http.StatusOK, map[string]any{"models": a.loadDimStats("model", since, sinceArg)})
}

// handleAgents Agent 聚合（Agent = 用户使用的客户端工具）。支持 ?days=N。
// 返回前应用用户自定义的 Agent 显示名别名（agent_aliases），「其他」等原始名
// 可按用户偏好重命名展示（#问题 4）。
func (a *API) handleAgents(w http.ResponseWriter, r *http.Request) {
	since, sinceArg := daysFilter(r)
	stats := a.loadDimStats("agent", since, sinceArg)
	aliases := a.getAgentAliases()
	if len(aliases) > 0 {
		for i := range stats {
			if disp, ok := aliases[stats[i].Name]; ok && disp != "" {
				stats[i].Name = disp
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"agents": stats})
}

// agentAliasesKey settings 表存储 key（JSON map：原始 agent 名 → 显示名）。
const agentAliasesKey = "agent_aliases"

// getAgentAliases 读取用户自定义的 Agent 显示名别名（JSON map：原始名 → 显示名）。
// 未配置返回空 map。带短 TTL 缓存由 settings 缓存统一承担（getSetting 直接查表，
// 改动即时可见——与 custom_providers 不同，此处无热路径，无需单独缓存）。
func (a *API) getAgentAliases() map[string]string {
	raw := a.getSetting(agentAliasesKey)
	if raw == "" {
		return nil
	}
	m := map[string]string{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		log.Printf("settings agent_aliases parse failed: %v", err)
		return nil
	}
	return m
}

// dimDetailRow 维度明细：某 Agent 下的各供应商×模型，或某供应商下的各 Agent×模型。
type dimDetailRow struct {
	Dim      string  `json:"dim"`   // 交叉维度名：provider 或 agent
	Model    string  `json:"model"` // 模型名
	Tokens   int64   `json:"tokens"`
	Requests int64   `json:"requests"`
	Cost     float64 `json:"cost"`
}

// loadDimDetail 按维度值 + 交叉列 + model 拆解某条目的明细（成本按模型定价现算）。
// dimCol 是主维度列（如 agent），xCol 是交叉维度列（如 provider）。
func (a *API) loadDimDetail(dimCol, xCol, value string, since string, sinceArg any) []dimDetailRow {
	pricing := a.getPricingMap()
	q := "SELECT " + xCol + ", model, COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events WHERE " + dimCol + " = ?"
	args := []any{value}
	if since != "" {
		q += since
		args = append(args, sinceArg)
	}
	q += " GROUP BY " + xCol + ", model"
	rows, err := a.db.Query(q, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	// 按 (交叉维度, 归一化模型名) 合并：同一模型的不同上下文变体（[1M] 等）聚合为一条。
	merged := map[string]*dimDetailRow{}
	order := []string{}
	for rows.Next() {
		var x, model string
		var p, c, t, req int64
		if rows.Scan(&x, &model, &p, &c, &t, &req) != nil {
			continue
		}
		key := x + "\x00" + normalizeModelName(model)
		row := merged[key]
		if row == nil {
			row = &dimDetailRow{Dim: x, Model: normalizeModelName(model)}
			merged[key] = row
			order = append(order, key)
		}
		row.Tokens += t
		row.Requests += req
		row.Cost += costOf(pricing, model, p, c)
	}
	out := make([]dimDetailRow, 0, len(order))
	for _, k := range order {
		out = append(out, *merged[k])
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Tokens > out[j].Tokens })
	return out
}

// handleAgentDetail /api/agents/<agent>：该 Agent 下各供应商×模型的消耗拆解。支持 ?days=N。
// URL 里的名字可能是显示名别名（Agent 列表按别名展示，#问题 4），查询前需按
// agent_aliases（原始名 → 显示名）反映射回原始名；无映射时按原名直查。
func (a *API) handleAgentDetail(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/agents/")
	name = strings.TrimSuffix(name, "/")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing agent name"})
		return
	}
	since, sinceArg := daysFilter(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"agent": name,
		"rows":  a.loadDimDetail("agent", "provider", a.resolveAgentName(name), since, sinceArg),
	})
}

// resolveAgentName 把（可能的）显示名别名反映射回 token_events 里的原始 agent 名。
// 无别名配置或未命中时原样返回。
func (a *API) resolveAgentName(name string) string {
	for original, display := range a.getAgentAliases() {
		if display == name && original != "" {
			return original
		}
	}
	return name
}

// handleProviderDetail /api/providers/<provider>：该供应商下各 Agent×模型的消耗拆解。支持 ?days=N。
func (a *API) handleProviderDetail(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/providers/")
	name = strings.TrimSuffix(name, "/")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing provider name"})
		return
	}
	since, sinceArg := daysFilter(r)
	rows := a.loadDimDetail("provider", "agent", name, since, sinceArg)
	// 交叉维度为 Agent 时应用显示名别名（#问题 4），与 Agent 聚合页口径一致
	if len(rows) > 0 {
		aliases := a.getAgentAliases()
		if len(aliases) > 0 {
			for i := range rows {
				if disp, ok := aliases[rows[i].Dim]; ok && disp != "" {
					rows[i].Dim = disp
				}
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"provider": name,
		"rows":     rows,
	})
}

// ---------- 告警 ----------

// handleAlerts 预算告警：读取预算配置，计算当前用量与触发状态。
// 预算可按 全局 / 供应商 / Agent / 模型 四个维度分别设置（每条独立）。
func (a *API) handleAlerts(w http.ResponseWriter, r *http.Request) {
	type alertState struct {
		Dimension   string  `json:"dimension"`
		Target      string  `json:"target"`
		DailyTokens int64   `json:"dailyTokens"` // 预算
		UsedTokens  int64   `json:"usedTokens"`  // 今日已用
		UsedRatio   float64 `json:"usedRatio"`
		Triggered   bool    `json:"triggered"`
	}
	day0 := time.Now().Format("2006-01-02") + " 00:00:00.000"

	// 今日各维度用量
	var globalUsed int64
	_ = a.db.QueryRow("SELECT COALESCE(SUM(total_tokens),0) FROM token_events WHERE timestamp >= ?", day0).Scan(&globalUsed)
	dimUsed := map[string]map[string]int64{} // dimension -> target -> used
	for _, dim := range []string{"provider", "agent", "model"} {
		dimUsed[dim] = map[string]int64{}
		rows, err := a.db.Query(
			"SELECT "+dim+", COALESCE(SUM(total_tokens),0) FROM token_events WHERE timestamp >= ? AND "+dim+" != '' GROUP BY "+dim,
			day0,
		)
		if err == nil {
			for rows.Next() {
				var name string
				var n int64
				if rows.Scan(&name, &n) == nil {
					dimUsed[dim][name] = n
				}
			}
			rows.Close()
		}
	}

	budgets := a.getBudgets()
	alerts := []alertState{}
	for _, b := range budgets {
		// P2-4：DailyTokens ≤ 0 的预算视为未设置——不参与触发、不在使用区显示
		//（AlertsTab 使用区直接渲染本列表；设置列表仍可见可删）。
		// 写侧 /api/settings 已拒绝非正整数，此处兜底历史脏数据。
		if b.DailyTokens <= 0 {
			continue
		}
		dim := b.Dimension
		target := b.Target
		// 兼容旧格式：无 dimension 时按 model 处理；model="*" 视为 global
		if dim == "" {
			if b.Model == "*" {
				dim, target = "global", ""
			} else {
				dim, target = "model", b.Model
			}
		}
		var used int64
		if dim == "global" {
			used = globalUsed
		} else if m, ok := dimUsed[dim]; ok {
			used = m[target]
		}
		alerts = append(alerts, alertState{
			Dimension: dim, Target: target, DailyTokens: b.DailyTokens, UsedTokens: used,
			UsedRatio: ratioOf(used, b.DailyTokens), Triggered: used >= b.DailyTokens,
		})
	}

	// 附加可设告警的维度列表（供应商/Agent/模型，供前端选择）
	writeJSON(w, http.StatusOK, map[string]any{
		"alerts":       alerts,
		"globalToday":  globalUsed,
		"providers":    sortedKeys(dimUsed["provider"]),
		"agents":       sortedKeys(dimUsed["agent"]),
		"models":       sortedKeys(dimUsed["model"]),
	})
}

// sortedKeys 返回 map 的 key 排序列表。
func sortedKeys(m map[string]int64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func ratioOf(used, budget int64) float64 {
	if budget <= 0 {
		return 0
	}
	return float64(used) / float64(budget)
}

// ---------- 设置 ----------

// allowedSettingKeys 允许经 /api/settings 写入的 key 白名单（#5）。
// sync_token 仅供桌面端登录流程写入（SettingsTab.doLogin 拿到 JWT 后存储）；
// GET /api/settings 的 Settings struct 不含该字段，故凭证不会被读出。
// 纵深防御另由「回环绑定 + CORS Origin 白名单」承担，远程无法触达此接口。
var allowedSettingKeys = map[string]bool{
	"theme":         true,
	"pricing":       true,
	"budgets":       true,
	"sync_token":    true,
	"sync_account":  true,
	"sync_enabled":  true,
	"sync_last":     true,
	"sync_device":   true,
	"widget_fields": true, // 悬浮卡片显示字段（JSON 字符串数组）
	"widget_pos":    true, // 悬浮卡片窗口位置（JSON {x,y}）
	// 注：v0.1.4 的 widget_opacity（悬浮卡片不透明度）已移除，本地残留值直接忽略。
	// agent_aliases：Agent 显示名别名（JSON map：原始名 → 自定义显示名）。
	// 用于把「其他」等未识别 Agent 重命名为用户可读的名称（#问题 4）。
	"agent_aliases": true,
}

// handleSettings GET 返回全部设置（不含 sync_token 等凭证）；POST 更新单个 key。
func (a *API) handleSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, a.loadSettings())
		return
	}
	if r.Method == http.MethodPost {
		var req struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Key == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
			return
		}
		// key 白名单：拒绝写 sync_token 等未列入的 key（防远程覆盖云账户凭证）
		if !allowedSettingKeys[req.Key] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key not allowed"})
			return
		}
		// 校验 pricing / budgets 为合法 JSON
		if req.Key == "pricing" || req.Key == "budgets" {
			if !json.Valid([]byte(req.Value)) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
				return
			}
		}
		// P2-4 写侧校验：budgets 必须是 []BudgetItem 且每条 dailyTokens 为正整数
		//（≤0 的预算无意义，读侧会恒触发/永不触发；非整数 JSON 数字反序列化失败）。
		if req.Key == "budgets" {
			var items []BudgetItem
			if err := json.Unmarshal([]byte(req.Value), &items); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid budgets"})
				return
			}
			for _, b := range items {
				if b.DailyTokens <= 0 {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "dailyTokens must be a positive integer"})
					return
				}
			}
		}
		if err := a.setSetting(req.Key, req.Value); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

// handlePricing 返回完整定价映射（仅用户已保存），供设置页展示。
func (a *API) handlePricing(w http.ResponseWriter, r *http.Request) {
	m := a.getPricingMap()
	items := []PricedItem{}
	for model, p := range m {
		items = append(items, PricedItem{Model: model, Prompt: f2s(p.Prompt), Completion: f2s(p.Completion)})
	}
	sortItems(items)
	writeJSON(w, http.StatusOK, map[string]any{"pricing": items})
}

// handlePricingDefaults 返回内置常见模型参考价（设置页「一键填入」用；默认不展示、不参与成本）。
func (a *API) handlePricingDefaults(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"pricing": a.defaultPricingList()})
}

// handlePricingCatalog 返回内置模型价格目录（按供应商归类，含输入/输出价格）。
// 供「模型价格表」按价格 / 性价比排行；桌面离线可用，标注为参考价。
func (a *API) handlePricingCatalog(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"catalog": pricingCatalog})
}

func f2s(f float64) string {
	return strings.TrimRight(strings.TrimRight(strconv.FormatFloat(f, 'f', 4, 64), "0"), ".")
}

func sortItems(items []PricedItem) {
	sort.Slice(items, func(i, j int) bool { return items[i].Model < items[j].Model })
}

// ---------- 同步（P4：见 sync.go 的 handleSync） ----------
