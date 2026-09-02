package localapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestClearDataResetsSyncState 锁住回归：清除本地数据必须同时重置下载游标
// （sync_dl_seq=0）并清空设备 ID（下次同步重新生成）——否则云端已有事件
// 因「seq > 游标 + 排除本设备」永远拉不回来，表现为清除后下载 0 条。
func TestClearDataResetsSyncState(t *testing.T) {
	a := newTestAPI(t)
	if _, err := a.db.Exec(`CREATE TABLE token_events (
		event_id TEXT PRIMARY KEY, project_id TEXT, session_id TEXT, provider TEXT,
		agent TEXT, model TEXT, prompt_tokens INTEGER, completion_tokens INTEGER,
		total_tokens INTEGER, cache_read_tokens INTEGER, cache_creation_tokens INTEGER,
		duration_ms INTEGER, timestamp TEXT)`); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`INSERT INTO token_events (event_id, model) VALUES ('e1', 'gpt-5')`); err != nil {
		t.Fatal(err)
	}
	if err := a.setSetting("sync_dl_seq", "123"); err != nil {
		t.Fatal(err)
	}
	if err := a.setSetting("sync_device", "dev-old"); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/clear-data", nil)
	rec := httptest.NewRecorder()
	a.handleClearData(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Deleted int `json:"deleted"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Deleted != 1 {
		t.Fatalf("deleted = %d, want 1", resp.Deleted)
	}
	if v := a.getSetting("sync_dl_seq"); v != "0" {
		t.Fatalf("sync_dl_seq = %q, want 0", v)
	}
	if v := a.getSetting("sync_device"); v != "" {
		t.Fatalf("sync_device = %q, want empty", v)
	}
	// 置空后下次同步自动生成新设备 ID，且不是旧值
	id, err := a.syncDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	if id == "" || id == "dev-old" {
		t.Fatalf("regenerated device id = %q", id)
	}
}

// 防止回归：清除不碰其他配置（定价/主题等保留）。
func TestClearDataKeepsOtherSettings(t *testing.T) {
	a := newTestAPI(t)
	if _, err := a.db.Exec(`CREATE TABLE token_events (event_id TEXT PRIMARY KEY)`); err != nil {
		t.Fatal(err)
	}
	if err := a.setSetting("theme", "cosmos"); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/clear-data", nil)
	rec := httptest.NewRecorder()
	a.handleClearData(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if v := a.getSetting("theme"); v != "cosmos" {
		t.Fatalf("theme = %q, want cosmos", v)
	}
}
