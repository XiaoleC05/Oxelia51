// Package localapi 本地优先模式的只读统计接口（P3 桌面端 UI 数据源）。
// 查询本地 SQLite 账本（token_events），返回 JSON 给桌面 UI；不参与转发路径。
// 语义与云侧一致：纵（时间趋势）+ 横（模型/项目/会话对比）。
package localapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// API 本地只读统计 API
type API struct {
	db *sql.DB

	// #26：定价缓存。getPricingMap 被 overview/projects/sessions 频繁调用，
	// 原实现每次查 settings 表 + 解析 JSON。缓存 5s，保存定价时主动失效。
	pmu             sync.Mutex
	pricingCached   map[string]ModelPrice
	pricingCachedAt time.Time

	// 自定义供应商缓存（custom.go）：Registry.Match 热路径经 CustomSource 读取，
	// 短 TTL + 写入时主动失效，不每请求查 SQL。
	cmu            sync.Mutex
	customCached   []adapter.CustomProvider
	customCachedAt time.Time

	// 汇率缓存（rate.go）：USD→CNY 每日更新，离线回退上次成功值 / 内置参考值。
	rateMu sync.Mutex
	rate   *rateCache
}

// New 创建本地 API（db 来自 recorder.SQLiteWriter.DB()）；
// 启动时读取上次汇率并挂起每日更新后台任务。
func New(db *sql.DB) *API {
	a := &API{db: db}
	a.loadRateFromSettings()
	a.ensureRateLoop()
	return a
}

// Handler 返回路由 mux（全局 CORS 中间件处理 OPTIONS 预检，POST 才不被浏览器拦）
func (a *API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/overview", a.handleOverview)
	mux.HandleFunc("/api/providers", a.handleProviders)
	mux.HandleFunc("/api/providers/", a.handleProviderDetail)
	mux.HandleFunc("/api/agents", a.handleAgents)
	mux.HandleFunc("/api/agents/", a.handleAgentDetail)
	mux.HandleFunc("/api/alerts", a.handleAlerts)
	mux.HandleFunc("/api/settings", a.handleSettings)
	mux.HandleFunc("/api/custom-providers", a.handleCustomProviders)
	mux.HandleFunc("/api/custom-providers/delete", a.handleCustomProvidersDelete)
	mux.HandleFunc("/api/pricing/defaults", a.handlePricingDefaults)
	mux.HandleFunc("/api/pricing/catalog", a.handlePricingCatalog)
	mux.HandleFunc("/api/pricing/rate", a.handlePricingRate)
	mux.HandleFunc("/api/pricing", a.handlePricing)
	mux.HandleFunc("/api/sync", a.handleSync)
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/", a.handleOptions) // 未知路径 404
	return withCORS(mux)
}

// allowedLocalOrigins 桌面 UI 可能的来源：Tauri webview（tauri.localhost）与 Vite dev。
// 本地 sidecar 只听回环，但仍需校验 Origin，防止本机任意网页跨源读账本 / 改设置（#5）。
var allowedLocalOrigins = map[string]bool{
	"http://localhost:5173":   true, // Vite dev
	"http://127.0.0.1:5173":   true,
	"http://tauri.localhost":  true, // Tauri 2 Windows webview
	"https://tauri.localhost": true, // Tauri 2 部分配置
	"http://localhost:17800":  true, // 同源兜底
	"http://127.0.0.1:17800":  true,
}

// withCORS 全局 CORS 中间件：仅放行桌面 webview / Vite dev 已知来源，OPTIONS 预检 204。
// 无 Origin 头（非浏览器，如 curl / sidecar 自身）放行；未知 Origin 拒绝。
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !allowedLocalOrigins[origin] {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	// CORS 头由 withCORS 中间件统一注入；此处只设内容类型
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (a *API) handleOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := a.db.Ping(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type rowCount struct {
	Tokens   int64   `json:"tokens"`
	Requests int64   `json:"requests"`
	Cost     float64 `json:"cost"`
}

// aggCost 计算某个时间范围内的 USD 成本（按模型用定价表逐模型聚合）。
func (a *API) aggCost(since string) float64 {
	pricing := a.getPricingMap()
	rows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0) FROM token_events WHERE timestamp >= ? GROUP BY model",
		since,
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

func (a *API) aggCostAll() float64 {
	pricing := a.getPricingMap()
	rows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0) FROM token_events GROUP BY model",
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

// Overview 总览接口：今日/近7日/近30日/累计 + 模型/项目/会话排行 + 14 天趋势
func (a *API) handleOverview(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	day0 := now.Format("2006-01-02") + " 00:00:00.000"
	week0 := now.AddDate(0, 0, -6).Format("2006-01-02") + " 00:00:00.000"
	month0 := now.AddDate(0, 0, -29).Format("2006-01-02") + " 00:00:00.000"

	sum := func(since string) rowCount {
		var c rowCount
		_ = a.db.QueryRow(
			"SELECT COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events WHERE timestamp >= ?",
			since,
		).Scan(&c.Tokens, &c.Requests)
		c.Cost = a.aggCost(since)
		return c
	}

	today := sum(day0)
	week := sum(week0)
	month := sum(month0)

	var total rowCount
	_ = a.db.QueryRow("SELECT COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events").Scan(&total.Tokens, &total.Requests)
	total.Cost = a.aggCostAll()

	byModel := []struct {
		Model    string  `json:"model"`
		Tokens   int64   `json:"tokens"`
		Requests int64   `json:"requests"`
		Cost     float64 `json:"cost"`
	}{}
	pricing := a.getPricingMap()
	rows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(total_tokens),0), COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COUNT(*) FROM token_events WHERE model != '' GROUP BY model ORDER BY SUM(total_tokens) DESC LIMIT 8",
	)
	if err == nil {
		for rows.Next() {
			var m struct {
				Model    string  `json:"model"`
				Tokens   int64   `json:"tokens"`
				Requests int64   `json:"requests"`
				Cost     float64 `json:"cost"`
			}
			var p, c int64
			if rows.Scan(&m.Model, &m.Tokens, &p, &c, &m.Requests) == nil {
				m.Cost = costOf(pricing, m.Model, p, c)
				byModel = append(byModel, m)
			}
		}
		rows.Close()
	}

	trend := []struct {
		Date     string `json:"date"`
		Tokens   int64  `json:"tokens"`
		Requests int64  `json:"requests"`
	}{}
	rows, err = a.db.Query(
		"SELECT substr(timestamp,1,10) AS d, COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events WHERE timestamp >= date('now','-13 days') GROUP BY d ORDER BY d",
	)
	if err == nil {
		for rows.Next() {
			var t struct {
				Date     string `json:"date"`
				Tokens   int64  `json:"tokens"`
				Requests int64  `json:"requests"`
			}
			if rows.Scan(&t.Date, &t.Tokens, &t.Requests) == nil {
				trend = append(trend, t)
			}
		}
		rows.Close()
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"today":      today,
		"week":       week,
		"month":      month,
		"total":      total,
		"byModel":    byModel,
		"byProvider": a.loadDimStats("provider", "", nil),
		"byAgent":    a.loadDimStats("agent", "", nil),
		"trend":      trend,
	})
}
