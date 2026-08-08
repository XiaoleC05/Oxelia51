// Package localapi 本地优先模式的只读统计接口（P3 桌面端 UI 数据源）。
// 查询本地 SQLite 账本（token_events），返回 JSON 给桌面 UI；不参与转发路径。
// 语义与云侧一致：纵（时间趋势）+ 横（模型/项目/会话对比）。
package localapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// API 本地只读统计 API
type API struct {
	db *sql.DB
}

// New 创建本地 API（db 来自 recorder.SQLiteWriter.DB()）
func New(db *sql.DB) *API { return &API{db: db} }

// Handler 返回路由 mux
func (a *API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/overview", a.handleOverview)
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/", a.handleOptions) // OPTIONS 预检 + 未知路径 404
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	// 桌面 UI（Tauri webview / Vite dev）跨源读取本地接口
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (a *API) handleOptions(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusNoContent)
		return
	}
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
	Tokens   int64 `json:"tokens"`
	Requests int64 `json:"requests"`
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
		return c
	}

	today := sum(day0)
	week := sum(week0)
	month := sum(month0)

	var total rowCount
	_ = a.db.QueryRow("SELECT COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events").Scan(&total.Tokens, &total.Requests)

	byModel := []struct {
		Model    string `json:"model"`
		Tokens   int64  `json:"tokens"`
		Requests int64  `json:"requests"`
	}{}
	rows, err := a.db.Query(
		"SELECT model, COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events WHERE model != '' GROUP BY model ORDER BY SUM(total_tokens) DESC LIMIT 8",
	)
	if err == nil {
		for rows.Next() {
			var m struct {
				Model    string `json:"model"`
				Tokens   int64  `json:"tokens"`
				Requests int64  `json:"requests"`
			}
			if rows.Scan(&m.Model, &m.Tokens, &m.Requests) == nil {
				byModel = append(byModel, m)
			}
		}
		rows.Close()
	}

	byProject := []struct {
		ProjectID string `json:"projectId"`
		Tokens    int64  `json:"tokens"`
		Requests  int64  `json:"requests"`
	}{}
	rows, err = a.db.Query(
		"SELECT project_id, COALESCE(SUM(total_tokens),0), COUNT(*) FROM token_events WHERE project_id != '' GROUP BY project_id ORDER BY SUM(total_tokens) DESC LIMIT 10",
	)
	if err == nil {
		for rows.Next() {
			var p struct {
				ProjectID string `json:"projectId"`
				Tokens    int64  `json:"tokens"`
				Requests  int64  `json:"requests"`
			}
			if rows.Scan(&p.ProjectID, &p.Tokens, &p.Requests) == nil {
				byProject = append(byProject, p)
			}
		}
		rows.Close()
	}

	sessions := []struct {
		SessionID string `json:"sessionId"`
		Tokens    int64  `json:"tokens"`
		Requests  int64  `json:"requests"`
		LastTs    string `json:"lastTs"`
	}{}
	rows, err = a.db.Query(
		"SELECT session_id, COALESCE(SUM(total_tokens),0), COUNT(*), MAX(timestamp) FROM token_events WHERE session_id != '' GROUP BY session_id ORDER BY MAX(timestamp) DESC LIMIT 10",
	)
	if err == nil {
		for rows.Next() {
			var s struct {
				SessionID string `json:"sessionId"`
				Tokens    int64  `json:"tokens"`
				Requests  int64  `json:"requests"`
				LastTs    string `json:"lastTs"`
			}
			if rows.Scan(&s.SessionID, &s.Tokens, &s.Requests, &s.LastTs) == nil {
				sessions = append(sessions, s)
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
		"today":     today,
		"week":      week,
		"month":     month,
		"total":     total,
		"byModel":   byModel,
		"byProject": byProject,
		"sessions":  sessions,
		"trend":     trend,
	})
}
