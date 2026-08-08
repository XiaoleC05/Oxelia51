package localapi

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ---------- 项目 ----------

type projectStat struct {
	ProjectID string  `json:"projectId"`
	Tokens    int64   `json:"tokens"`
	Requests  int64   `json:"requests"`
	Cost      float64 `json:"cost"`
	Models    int     `json:"models"`
	LastTs    string  `json:"lastTs"`
}

func (a *API) projectCost(projectID string) float64 {
	pricing := a.getPricingMap()
	rows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0) FROM token_events WHERE project_id = ? GROUP BY model",
		projectID,
	)
	if err != nil {
		return 0
	}
	defer rows.Close()
	var cost float64
	for rows.Next() {
		var model string
		var p, c int64
		if rows.Scan(&model, &p, &c) == nil {
			cost += costOf(pricing, model, p, c)
		}
	}
	return cost
}

// handleProjects 项目列表（Cursor 式：按 project_id 聚合）。
func (a *API) handleProjects(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(
		"SELECT project_id, COALESCE(SUM(total_tokens),0), COUNT(*), COUNT(DISTINCT model), MAX(timestamp) FROM token_events WHERE project_id != '' GROUP BY project_id ORDER BY MAX(timestamp) DESC LIMIT 100",
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	projects := []projectStat{}
	for rows.Next() {
		var p projectStat
		if rows.Scan(&p.ProjectID, &p.Tokens, &p.Requests, &p.Models, &p.LastTs) == nil {
			projects = append(projects, p)
		}
	}
	rows.Close() // 先关主查询再逐项算成本，避免单连接下嵌套查询死锁
	for i := range projects {
		projects[i].Cost = a.projectCost(projects[i].ProjectID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

// ---------- 会话 ----------

type sessionStat struct {
	SessionID string  `json:"sessionId"`
	ProjectID string  `json:"projectId"`
	Tokens    int64   `json:"tokens"`
	Requests  int64   `json:"requests"`
	Cost      float64 `json:"cost"`
	Models    int     `json:"models"`
	LastTs    string  `json:"lastTs"`
}

func (a *API) sessionCost(sessionID string) float64 {
	pricing := a.getPricingMap()
	rows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0) FROM token_events WHERE session_id = ? GROUP BY model",
		sessionID,
	)
	if err != nil {
		return 0
	}
	defer rows.Close()
	var cost float64
	for rows.Next() {
		var model string
		var p, c int64
		if rows.Scan(&model, &p, &c) == nil {
			cost += costOf(pricing, model, p, c)
		}
	}
	return cost
}

// handleSessions 会话时间线（分页，按最近活动倒序）。
func (a *API) handleSessions(w http.ResponseWriter, r *http.Request) {
	limit := 50
	rows, err := a.db.Query(
		"SELECT session_id, MAX(project_id), COALESCE(SUM(total_tokens),0), COUNT(*), COUNT(DISTINCT model), MAX(timestamp) FROM token_events WHERE session_id != '' GROUP BY session_id ORDER BY MAX(timestamp) DESC LIMIT ?",
		limit,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	sessions := []sessionStat{}
	for rows.Next() {
		var s sessionStat
		if rows.Scan(&s.SessionID, &s.ProjectID, &s.Tokens, &s.Requests, &s.Models, &s.LastTs) == nil {
			sessions = append(sessions, s)
		}
	}
	rows.Close() // 先关主查询再逐项算成本
	for i := range sessions {
		sessions[i].Cost = a.sessionCost(sessions[i].SessionID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}

// handleSessionDetail 会话详情：按模型 + 时间线拆解。
func (a *API) handleSessionDetail(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	id = strings.TrimSuffix(id, "/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing session id"})
		return
	}

	// 会话基本信息
	var s sessionStat
	err := a.db.QueryRow(
		"SELECT session_id, MAX(project_id), COALESCE(SUM(total_tokens),0), COUNT(*), COUNT(DISTINCT model), MAX(timestamp) FROM token_events WHERE session_id = ? GROUP BY session_id",
		id,
	).Scan(&s.SessionID, &s.ProjectID, &s.Tokens, &s.Requests, &s.Models, &s.LastTs)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not found"})
		return
	}
	s.Cost = a.sessionCost(id)

	// 按模型拆解
	pricing := a.getPricingMap()
	type modelRow struct {
		Model    string  `json:"model"`
		Tokens   int64   `json:"tokens"`
		Requests int64   `json:"requests"`
		Cost     float64 `json:"cost"`
	}
	models := []modelRow{}
	mrows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(total_tokens),0), COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COUNT(*) FROM token_events WHERE session_id = ? GROUP BY model ORDER BY SUM(total_tokens) DESC",
		id,
	)
	if err == nil {
		for mrows.Next() {
			var m modelRow
			var p, c int64
			if mrows.Scan(&m.Model, &m.Tokens, &p, &c, &m.Requests) == nil {
				m.Cost = costOf(pricing, m.Model, p, c)
				models = append(models, m)
			}
		}
		mrows.Close()
	}

	// 最近 20 条明细
	type event struct {
		Model    string `json:"model"`
		Tokens   int64  `json:"tokens"`
		Duration int64  `json:"durationMs"`
		Ts       string `json:"ts"`
	}
	events := []event{}
	erows, err := a.db.Query(
		"SELECT model, total_tokens, duration_ms, timestamp FROM token_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 20",
		id,
	)
	if err == nil {
		for erows.Next() {
			var e event
			if erows.Scan(&e.Model, &e.Tokens, &e.Duration, &e.Ts) == nil {
				events = append(events, e)
			}
		}
		erows.Close()
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"session": s,
		"models":  models,
		"events":  events,
	})
}

// ---------- 告警 ----------

// handleAlerts 预算告警：读取预算配置，计算当前用量与触发状态。
func (a *API) handleAlerts(w http.ResponseWriter, r *http.Request) {
	type alertState struct {
		Model       string  `json:"model"`
		DailyTokens int64   `json:"dailyTokens"` // 预算
		UsedTokens  int64   `json:"usedTokens"`  // 今日已用
		UsedRatio   float64 `json:"usedRatio"`
		Triggered   bool    `json:"triggered"`
	}
	day0 := time.Now().Format("2006-01-02") + " 00:00:00.000"

	// 全局 + 各模型今日用量
	var globalUsed int64
	_ = a.db.QueryRow("SELECT COALESCE(SUM(total_tokens),0) FROM token_events WHERE timestamp >= ?", day0).Scan(&globalUsed)
	modelUsed := map[string]int64{}
	mrows, err := a.db.Query("SELECT model, COALESCE(SUM(total_tokens),0) FROM token_events WHERE timestamp >= ? GROUP BY model", day0)
	if err == nil {
		for mrows.Next() {
			var m string
			var n int64
			if mrows.Scan(&m, &n) == nil {
				modelUsed[m] = n
			}
		}
		mrows.Close()
	}

	budgets := a.getBudgets()
	alerts := []alertState{}
	// 全局预算
	for _, b := range budgets {
		if b.Model == "*" {
			used := globalUsed
			alerts = append(alerts, alertState{
				Model: "*", DailyTokens: b.DailyTokens, UsedTokens: used,
				UsedRatio: ratioOf(used, b.DailyTokens), Triggered: used >= b.DailyTokens,
			})
			continue
		}
		used := modelUsed[b.Model]
		alerts = append(alerts, alertState{
			Model: b.Model, DailyTokens: b.DailyTokens, UsedTokens: used,
			UsedRatio: ratioOf(used, b.DailyTokens), Triggered: used >= b.DailyTokens,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"alerts": alerts, "globalToday": globalUsed})
}

func ratioOf(used, budget int64) float64 {
	if budget <= 0 {
		return 0
	}
	return float64(used) / float64(budget)
}

// ---------- 设置 ----------

// handleSettings GET 返回全部设置；POST 更新单个 key。
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

// handlePricing 返回完整定价映射（默认 + 用户覆盖），供设置页展示。
func (a *API) handlePricing(w http.ResponseWriter, r *http.Request) {
	m := a.getPricingMap()
	items := []PricedItem{}
	for model, p := range m {
		items = append(items, PricedItem{Model: model, Prompt: f2s(p.Prompt), Completion: f2s(p.Completion)})
	}
	sortItems(items)
	writeJSON(w, http.StatusOK, map[string]any{"pricing": items})
}

func f2s(f float64) string {
	return strings.TrimRight(strings.TrimRight(strconv.FormatFloat(f, 'f', 4, 64), "0"), ".")
}

func sortItems(items []PricedItem) {
	sort.Slice(items, func(i, j int) bool { return items[i].Model < items[j].Model })
}

// ---------- 同步（P4：见 sync.go 的 handleSync） ----------
