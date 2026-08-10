package localapi

import (
	"testing"
	"time"
)

// newSyncTestAPI 建带 settings + token_events 两表的内存库 API（schema 对齐 recorder.sqliteCreateTableSQL）。
func newSyncTestAPI(t *testing.T) *API {
	t.Helper()
	a := newTestAPI(t)
	if _, err := a.db.Exec(`CREATE TABLE token_events (
		event_id           TEXT PRIMARY KEY,
		project_id         TEXT NOT NULL,
		session_id         TEXT NOT NULL DEFAULT '',
		provider           TEXT NOT NULL DEFAULT '',
		agent              TEXT NOT NULL DEFAULT '',
		model              TEXT NOT NULL DEFAULT '',
		prompt_tokens      INTEGER NOT NULL DEFAULT 0,
		completion_tokens  INTEGER NOT NULL DEFAULT 0,
		total_tokens       INTEGER NOT NULL DEFAULT 0,
		duration_ms        INTEGER NOT NULL DEFAULT 0,
		timestamp          TEXT NOT NULL,
		api_key_hash       TEXT NOT NULL DEFAULT '',
		partial            INTEGER NOT NULL DEFAULT 0
	)`); err != nil {
		t.Fatal(err)
	}
	return a
}

// TestSyncUploadTSMigration 旧版 sync_last（RFC3339）迁移为 sync_up_ts（localTimeLayout）；
// sync_up_ts 已有值时不迁移；两者皆空返回空（全量上传）。
func TestSyncUploadTSMigration(t *testing.T) {
	a := newTestAPI(t)
	if v := a.syncUploadTS(); v != "" {
		t.Fatalf("empty settings: expected \"\", got %q", v)
	}

	a.setSetting("sync_last", "2026-08-01T04:00:00Z")
	got := a.syncUploadTS()
	want := time.Date(2026, 8, 1, 4, 0, 0, 0, time.UTC).Local().Format(localTimeLayout)
	if got != want {
		t.Fatalf("migrated cursor: expected %q, got %q", want, got)
	}
	if v := a.getSetting("sync_up_ts"); v != want {
		t.Fatalf("sync_up_ts not persisted: %q", v)
	}

	// 已有 sync_up_ts 时以它为准，不再看 sync_last
	a.setSetting("sync_up_ts", "2026-08-02 00:00:00.000")
	a.setSetting("sync_last", "2026-08-03T00:00:00Z")
	if v := a.syncUploadTS(); v != "2026-08-02 00:00:00.000" {
		t.Fatalf("existing cursor overridden: %q", v)
	}
}

// TestSyncDownloadSeqDefault 缺省 0（首次全量下载）；非法值回退 0。
func TestSyncDownloadSeqDefault(t *testing.T) {
	a := newTestAPI(t)
	if v := a.syncDownloadSeq(); v != 0 {
		t.Fatalf("default: expected 0, got %d", v)
	}
	a.setSetting("sync_dl_seq", "42")
	if v := a.syncDownloadSeq(); v != 42 {
		t.Fatalf("expected 42, got %d", v)
	}
	a.setSetting("sync_dl_seq", "not-a-number")
	if v := a.syncDownloadSeq(); v != 0 {
		t.Fatalf("invalid: expected 0, got %d", v)
	}
}

// TestMergeCloudEventsDedupAndConflict 合并语义：
// 新事件插入；同 id 同内容幂等跳过；同 id 不同内容计冲突且保留先到版本。
func TestMergeCloudEventsDedupAndConflict(t *testing.T) {
	a := newSyncTestAPI(t)
	ev := cloudSyncEvent{
		EventID: "ev-1", DeviceID: "dev-other", ProjectID: "p1", SessionID: "s1",
		Provider: "openai", Agent: "cursor", Model: "gpt-5",
		PromptTokens: 10, CompletionTokens: 20, TotalTokens: 30, DurationMs: 100,
		TS: "2026-08-01T04:00:00Z",
	}
	ev2 := ev
	ev2.EventID = "ev-2"

	// 首批：2 条新事件
	n, c, err := a.mergeCloudEvents([]cloudSyncEvent{ev, ev2})
	if err != nil || n != 2 || c != 0 {
		t.Fatalf("first merge: n=%d c=%d err=%v", n, c, err)
	}
	var agent, ts string
	var total int64
	if err := a.db.QueryRow("SELECT agent, total_tokens, timestamp FROM token_events WHERE event_id = 'ev-1'").
		Scan(&agent, &total, &ts); err != nil {
		t.Fatal(err)
	}
	wantTS := time.Date(2026, 8, 1, 4, 0, 0, 0, time.UTC).Local().Format(localTimeLayout)
	if agent != "cursor" || total != 30 || ts != wantTS {
		t.Fatalf("merged row: agent=%q total=%d ts=%q (want ts %q)", agent, total, ts, wantTS)
	}

	// 重放同批：幂等，0 新增 0 冲突
	n, c, err = a.mergeCloudEvents([]cloudSyncEvent{ev, ev2})
	if err != nil || n != 0 || c != 0 {
		t.Fatalf("replay: n=%d c=%d err=%v", n, c, err)
	}

	// 同 id 不同内容：计 1 冲突，本地保留先到版本
	tampered := ev
	tampered.TotalTokens = 999
	n, c, err = a.mergeCloudEvents([]cloudSyncEvent{tampered})
	if err != nil || n != 0 || c != 1 {
		t.Fatalf("conflict: n=%d c=%d err=%v", n, c, err)
	}
	if err := a.db.QueryRow("SELECT total_tokens FROM token_events WHERE event_id = 'ev-1'").Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != 30 {
		t.Fatalf("first-writer row overwritten: total=%d", total)
	}
}
