package localapi

import (
	"encoding/json"
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
func daysFilter(r *http.Request) (string, any) {
	s := strings.TrimSpace(r.URL.Query().Get("days"))
	if s == "" {
		return "", nil
	}
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return "", nil
	}
	return " AND timestamp >= datetime('now', ?)", "-" + strconv.Itoa(n) + " days"
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
	writeJSON(w, http.StatusOK, map[string]any{"providers": stats})
}

// handleAgents Agent 聚合（Agent = 用户使用的客户端工具）。支持 ?days=N。
func (a *API) handleAgents(w http.ResponseWriter, r *http.Request) {
	since, sinceArg := daysFilter(r)
	writeJSON(w, http.StatusOK, map[string]any{"agents": a.loadDimStats("agent", since, sinceArg)})
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
	out := []dimDetailRow{}
	for rows.Next() {
		var x, model string
		var p, c, t, req int64
		if rows.Scan(&x, &model, &p, &c, &t, &req) != nil {
			continue
		}
		out = append(out, dimDetailRow{
			Dim: x, Model: model, Tokens: t, Requests: req, Cost: costOf(pricing, model, p, c),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Tokens > out[j].Tokens })
	return out
}

// handleAgentDetail /api/agents/<agent>：该 Agent 下各供应商×模型的消耗拆解。支持 ?days=N。
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
		"rows":  a.loadDimDetail("agent", "provider", name, since, sinceArg),
	})
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
	writeJSON(w, http.StatusOK, map[string]any{
		"provider": name,
		"rows":     a.loadDimDetail("provider", "agent", name, since, sinceArg),
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
		a.setSetting(req.Key, req.Value)
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
