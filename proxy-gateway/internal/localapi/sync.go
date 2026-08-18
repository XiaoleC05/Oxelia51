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
	"os"
	"strconv"
	"strings"
	"time"
)

// defaultCloudSyncBase 官方云同步端点。
const defaultCloudSyncBase = "https://oxelia51.com/api/sync"

// cloudSyncBase 返回云同步端点（#33：原硬编码，自建部署无法改）。
// 由 OXELIA_SYNC_BASE 覆盖，末尾斜杠自动剥离。
func cloudSyncBase() string {
	if v := strings.TrimSpace(os.Getenv("OXELIA_SYNC_BASE")); v != "" {
		return strings.TrimRight(v, "/")
	}
	return defaultCloudSyncBase
}

const localTimeLayout = "2006-01-02 15:04:05.000"

// syncDownloadMaxRounds 单次下载的最大分页轮数（防对端 hasMore 异常导致死循环）。
// 每页 2000 条，5 轮足够覆盖正常 backlog；未拉完的游标已落地，下次同步继续。
const syncDownloadMaxRounds = 5

type cloudSyncEvent struct {
	EventID             string `json:"eventId"`
	DeviceID            string `json:"deviceId"`
	ProjectID           string `json:"projectId"`
	SessionID           string `json:"sessionId"`
	Provider            string `json:"provider"`
	Agent               string `json:"agent"`
	Model               string `json:"model"`
	PromptTokens        int64  `json:"promptTokens"`
	CompletionTokens    int64  `json:"completionTokens"`
	TotalTokens         int64  `json:"totalTokens"`
	CacheReadTokens     int64  `json:"cacheReadTokens"`
	CacheCreationTokens int64  `json:"cacheCreationTokens"`
	DurationMs          int64  `json:"durationMs"`
	TS                  string `json:"ts"`
}

// syncDeviceID 返回本机设备 ID（首次生成时随机 8 字节 hex 并持久化）。
// crypto/rand 失败必须报错：静默继续会拿到全零 ID，多设备退化成同一「设备」互相覆盖。
func (a *API) syncDeviceID() (string, error) {
	id := a.getSetting("sync_device")
	if id == "" {
		b := make([]byte, 8)
		if _, err := rand.Read(b); err != nil {
			return "", fmt.Errorf("generate device id: %w", err)
		}
		id = "dev-" + hex.EncodeToString(b)
		if err := a.setSetting("sync_device", id); err != nil {
			return "", err
		}
	}
	return id, nil
}

func (a *API) syncToken() string { return a.getSetting("sync_token") }

// 同步游标拆为两个，互不影响（旧版上下行共用 sync_last 且按事件 ts 推进，
// 对端设备晚上传的历史事件 ts 早于游标会被永久漏掉）：
//   - sync_up_ts：上传游标，本地事件 ts（localTimeLayout，本地时区），只由上传推进。
//   - sync_dl_seq：下载游标，云端单调序号（int64 字符串），只由下载推进。
// sync_last 此后仅作「上次同步成功时间」展示用（见 markSyncSuccess）。

// syncUploadTS 返回上传游标（空 = 全量上传）。
// 迁移：sync_up_ts 为空且旧 sync_last 有值时，用 sync_last 初始化（RFC3339 → 本地时间）。
func (a *API) syncUploadTS() (string, error) {
	if v := a.getSetting("sync_up_ts"); v != "" {
		return v, nil
	}
	if s := a.getSetting("sync_last"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			v := t.Local().Format(localTimeLayout)
			if err := a.setSetting("sync_up_ts", v); err != nil {
				return "", err
			}
			return v, nil
		}
	}
	return "", nil
}

// syncDownloadSeq 返回下载游标（缺省 0 = 首次全量下载，event_id 去重保证幂等）。
func (a *API) syncDownloadSeq() int64 {
	v, _ := strconv.ParseInt(a.getSetting("sync_dl_seq"), 10, 64)
	return v
}

// markSyncSuccess 每次成功同步后记录：sync_enabled 置位，
// sync_last 写当前时间（RFC3339，仅「上次同步成功时间」展示，不再参与游标）。
func (a *API) markSyncSuccess() error {
	if err := a.setSetting("sync_enabled", "true"); err != nil {
		return err
	}
	return a.setSetting("sync_last", time.Now().UTC().Format(time.RFC3339))
}

// handleSync POST /api/sync：上传或下载，与云账户同步本地 token 事件。
// body: {"action":"upload"|"download"}，账户 token 来自 settings（UI 登录时写入）。
// 响应 {ok, action, uploaded?|downloaded?, conflicts}；conflicts 为内容不一致的
// event_id 数（防御性检测：账本事件不可变 + event_id 去重合并，正常恒 0）。
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
	deviceID, err := a.syncDeviceID()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	switch req.Action {
	case "upload":
		n, conflicts, err := a.syncUpload(token, deviceID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		if err := a.markSyncSuccess(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "upload", "uploaded": n, "conflicts": conflicts})
	case "download":
		n, conflicts, err := a.syncDownload(token, deviceID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		if err := a.markSyncSuccess(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "download", "downloaded": n, "conflicts": conflicts})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "未知 action"})
	}
}

// syncUpload 把上传游标（sync_up_ts）之后的本地事件上行到云。
// 返回云端实际插入条数与冲突数（云端按 event_id 去重，冲突正常恒 0，原样透传给 UI）。
func (a *API) syncUpload(token, deviceID string) (int, int, error) {
	cutoff, err := a.syncUploadTS()
	if err != nil {
		return 0, 0, err
	}

	// 读取游标之后的事件（本地时间戳为字符串格式）
	type localRow struct {
		eventID, projectID, sessionID, provider, agent, model, ts     string
		prompt, completion, total, cacheRead, cacheCreation, duration int64
	}
	localRows := []localRow{}
	q := "SELECT event_id, project_id, session_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, cache_read_tokens, cache_creation_tokens, duration_ms, timestamp FROM token_events"
	args := []any{}
	if cutoff != "" {
		q += " WHERE timestamp > ?"
		args = append(args, cutoff)
	}
	q += " ORDER BY timestamp ASC LIMIT 2000"
	rr, err := a.db.Query(q, args...)
	if err != nil {
		return 0, 0, err
	}
	defer rr.Close()
	for rr.Next() {
		var l localRow
		if err := rr.Scan(&l.eventID, &l.projectID, &l.sessionID, &l.provider, &l.agent, &l.model,
			&l.prompt, &l.completion, &l.total, &l.cacheRead, &l.cacheCreation, &l.duration, &l.ts); err != nil {
			return 0, 0, err
		}
		localRows = append(localRows, l)
	}
	if len(localRows) == 0 {
		return 0, 0, nil
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
			Provider: l.provider, Agent: l.agent, Model: l.model, PromptTokens: l.prompt, CompletionTokens: l.completion,
			TotalTokens: l.total, CacheReadTokens: l.cacheRead, CacheCreationTokens: l.cacheCreation,
			DurationMs: l.duration, TS: t.UTC().Format(time.RFC3339),
		})
	}

	body, _ := json.Marshal(map[string]any{"deviceId": deviceID, "events": events})
	req, err := http.NewRequest(http.MethodPost, cloudSyncBase()+"/upload", bytes.NewReader(body))
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("cloud upload: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return 0, 0, fmt.Errorf("cloud upload HTTP %d: %s", resp.StatusCode, string(b))
	}
	var up struct {
		Inserted  int `json:"inserted"`
		Conflicts int `json:"conflicts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&up); err != nil {
		return 0, 0, fmt.Errorf("cloud upload response: %w", err)
	}
	// 成功后推进上传游标到本批最大事件 ts（localTimeLayout，与 token_events.timestamp 同格式）
	if !maxT.IsZero() {
		if err := a.setSetting("sync_up_ts", maxT.Format(localTimeLayout)); err != nil {
			return 0, 0, err
		}
	}
	return up.Inserted, up.Conflicts, nil
}

// syncDownload 按下载游标（sync_dl_seq，云端单调序号）循环分页拉取其他设备的事件，
// 按 event_id 去重合并进本地，直到 hasMore=false（上限 syncDownloadMaxRounds 轮）。
// 全部完成后写 sync_dl_seq=最后返回的 nextCursor。返回新合并条数与冲突数。
func (a *API) syncDownload(token, deviceID string) (int, int, error) {
	after := a.syncDownloadSeq()
	total, conflicts := 0, 0
	for round := 0; round < syncDownloadMaxRounds; round++ {
		u := fmt.Sprintf("%s/download?after=%d&deviceId=%s", cloudSyncBase(), after, url.QueryEscape(deviceID))
		req, err := http.NewRequest(http.MethodGet, u, nil)
		if err != nil {
			return total, conflicts, err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return total, conflicts, fmt.Errorf("cloud download: %w", err)
		}
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
			resp.Body.Close()
			return total, conflicts, fmt.Errorf("cloud download HTTP %d: %s", resp.StatusCode, string(b))
		}
		var page struct {
			Events     []cloudSyncEvent `json:"events"`
			NextCursor int64            `json:"nextCursor"`
			HasMore    bool             `json:"hasMore"`
		}
		err = json.NewDecoder(resp.Body).Decode(&page)
		resp.Body.Close()
		if err != nil {
			return total, conflicts, fmt.Errorf("cloud download response: %w", err)
		}

		n, c, err := a.mergeCloudEvents(page.Events)
		if err != nil {
			return total, conflicts, err
		}
		total += n
		conflicts += c
		after = page.NextCursor
		if !page.HasMore {
			break
		}
	}
	if err := a.setSetting("sync_dl_seq", strconv.FormatInt(after, 10)); err != nil {
		return total, conflicts, err
	}
	return total, conflicts, nil
}

// mergeCloudEvents 把一页云端事件合并进本地账本（event_id 主键去重，INSERT OR IGNORE）。
// 冲突检测：被 IGNORE 跳过的 event_id，SELECT 本地已有行比对 provider/model/total_tokens/timestamp，
// 不一致计 1 次冲突（保留先到版本；防御性检测，正常恒 0）。
func (a *API) mergeCloudEvents(events []cloudSyncEvent) (int, int, error) {
	if len(events) == 0 {
		return 0, 0, nil
	}
	tx, err := a.db.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()
	ins, err := tx.Prepare(`INSERT OR IGNORE INTO token_events
		(event_id, project_id, session_id, provider, agent, model,
		 prompt_tokens, completion_tokens, total_tokens, cache_read_tokens, cache_creation_tokens, duration_ms, timestamp, api_key_hash)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return 0, 0, err
	}
	defer ins.Close()
	sel, err := tx.Prepare("SELECT provider, model, total_tokens, timestamp FROM token_events WHERE event_id = ?")
	if err != nil {
		return 0, 0, err
	}
	defer sel.Close()

	n, conflicts := 0, 0
	for _, e := range events {
		t, err := time.Parse(time.RFC3339, e.TS)
		if err != nil {
			continue
		}
		localTS := t.Local().Format(localTimeLayout)
		res, err := ins.Exec(e.EventID, e.ProjectID, e.SessionID, e.Provider, e.Agent, e.Model,
			e.PromptTokens, e.CompletionTokens, e.TotalTokens, e.CacheReadTokens, e.CacheCreationTokens, e.DurationMs, localTS, "sync")
		if err != nil {
			return n, conflicts, err
		}
		if ra, _ := res.RowsAffected(); ra > 0 {
			n++
			continue
		}
		// 被 IGNORE：event_id 已存在，比对内容是否一致
		var provider, model, ts string
		var totalTokens int64
		if err := sel.QueryRow(e.EventID).Scan(&provider, &model, &totalTokens, &ts); err != nil {
			continue // 查不到已有行（理论上不该发生），不计冲突
		}
		if provider != e.Provider || model != e.Model || totalTokens != e.TotalTokens || ts != localTS {
			conflicts++
		}
	}
	if err := tx.Commit(); err != nil {
		return n, conflicts, err
	}
	return n, conflicts, nil
}
