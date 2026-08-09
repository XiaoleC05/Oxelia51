package localapi

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// 云同步端点（Oxelia51 云平台；生产即 oxelia51.com）
const cloudSyncBase = "https://oxelia51.com/api/sync"

const localTimeLayout = "2006-01-02 15:04:05.000"

type cloudSyncEvent struct {
	EventID          string `json:"eventId"`
	DeviceID         string `json:"deviceId"`
	ProjectID        string `json:"projectId"`
	SessionID        string `json:"sessionId"`
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	PromptTokens     int64  `json:"promptTokens"`
	CompletionTokens int64  `json:"completionTokens"`
	TotalTokens      int64  `json:"totalTokens"`
	DurationMs       int64  `json:"durationMs"`
	TS               string `json:"ts"`
}

func (a *API) syncDeviceID() string {
	id := a.getSetting("sync_device")
	if id == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		id = "dev-" + hex.EncodeToString(b)
		a.setSetting("sync_device", id)
	}
	return id
}

func (a *API) syncToken() string { return a.getSetting("sync_token") }

func (a *API) syncLast() time.Time {
	s := a.getSetting("sync_last")
	if s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func (a *API) setSyncLast(t time.Time) {
	a.setSetting("sync_last", t.UTC().Format(time.RFC3339))
}

// handleSync POST /api/sync：上传或下载，与云账户同步本地 token 事件。
// body: {"action":"upload"|"download"}，账户 token 来自 settings（UI 登录时写入）。
func (a *API) handleSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}

	token := a.syncToken()
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "未登录同步账户"})
		return
	}
	deviceID := a.syncDeviceID()

	switch req.Action {
	case "upload":
		n, err := a.syncUpload(token, deviceID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "upload", "uploaded": n})
	case "download":
		n, err := a.syncDownload(token, deviceID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "download", "downloaded": n})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "未知 action"})
	}
}

// syncUpload 把 lastSync 之后的本地事件上行到云。
func (a *API) syncUpload(token, deviceID string) (int, error) {
	last := a.syncLast()

	// 读取 lastSync 之后的事件（本地时间戳为字符串格式）
	cutoff := ""
	if !last.IsZero() {
		cutoff = last.Local().Format(localTimeLayout)
	}
	type localRow struct {
		eventID, projectID, sessionID, provider, model, ts string
		prompt, completion, total, duration                int64
	}
	localRows := []localRow{}
	q := "SELECT event_id, project_id, session_id, provider, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, timestamp FROM token_events"
	args := []any{}
	if cutoff != "" {
		q += " WHERE timestamp > ?"
		args = append(args, cutoff)
	}
	q += " ORDER BY timestamp ASC LIMIT 2000"
	rr, err := a.db.Query(q, args...)
	if err != nil {
		return 0, err
	}
	defer rr.Close()
	for rr.Next() {
		var l localRow
		if err := rr.Scan(&l.eventID, &l.projectID, &l.sessionID, &l.provider, &l.model,
			&l.prompt, &l.completion, &l.total, &l.duration, &l.ts); err != nil {
			return 0, err
		}
		localRows = append(localRows, l)
	}
	if len(localRows) == 0 {
		return 0, nil
	}

	// 组装云端事件
	events := make([]cloudSyncEvent, 0, len(localRows))
	var maxT time.Time
	for _, l := range localRows {
		t, _ := time.ParseInLocation(localTimeLayout, l.ts, time.Local)
		if t.After(maxT) {
			maxT = t
		}
		events = append(events, cloudSyncEvent{
			EventID: l.eventID, DeviceID: deviceID, ProjectID: l.projectID, SessionID: l.sessionID,
			Provider: l.provider, Model: l.model, PromptTokens: l.prompt, CompletionTokens: l.completion,
			TotalTokens: l.total, DurationMs: l.duration, TS: t.UTC().Format(time.RFC3339),
		})
	}

	body, _ := json.Marshal(map[string]any{"deviceId": deviceID, "events": events})
	req, err := http.NewRequest(http.MethodPost, cloudSyncBase+"/upload", bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("cloud upload: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return 0, fmt.Errorf("cloud upload HTTP %d: %s", resp.StatusCode, string(b))
	}
	// 成功后推进游标
	if !maxT.IsZero() {
		a.setSyncLast(maxT)
	}
	a.setSetting("sync_enabled", "true")
	return len(events), nil
}

// syncDownload 下载他人设备在 after 之后的事件，按 event_id 去重合并进本地。
func (a *API) syncDownload(token, deviceID string) (int, error) {
	last := a.syncLast()
	after := last.UTC().Format(time.RFC3339)
	u := fmt.Sprintf("%s/download?after=%s&deviceId=%s", cloudSyncBase, url.QueryEscape(after), url.QueryEscape(deviceID))

	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("cloud download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return 0, fmt.Errorf("cloud download HTTP %d: %s", resp.StatusCode, string(b))
	}

	var cloud struct {
		Events []cloudSyncEvent `json:"events"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&cloud); err != nil {
		return 0, err
	}

	if len(cloud.Events) == 0 {
		a.setSetting("sync_enabled", "true")
		return 0, nil
	}

	// 合并进本地（event_id 主键去重）
	tx, err := a.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO token_events
		(event_id, project_id, session_id, provider, model,
		 prompt_tokens, completion_tokens, total_tokens, duration_ms, timestamp, api_key_hash)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	var maxT time.Time
	n := 0
	for _, e := range cloud.Events {
		t, err := time.Parse(time.RFC3339, e.TS)
		if err != nil {
			continue
		}
		if t.After(maxT) {
			maxT = t
		}
		if _, err := stmt.Exec(e.EventID, e.ProjectID, e.SessionID, e.Provider, e.Model,
			e.PromptTokens, e.CompletionTokens, e.TotalTokens, e.DurationMs,
			t.Local().Format(localTimeLayout), "sync"); err != nil {
			return n, err
		}
		n++
	}
	if err := tx.Commit(); err != nil {
		return n, err
	}
	if !maxT.IsZero() {
		a.setSyncLast(maxT)
	}
	a.setSetting("sync_enabled", "true")
	return n, nil
}
