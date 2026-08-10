package localapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// getProviders 走 GET /api/providers，返回 providers 列表。
func getProviders(t *testing.T, a *API) []dimStat {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/providers", nil)
	rec := httptest.NewRecorder()
	a.handleProviders(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/providers status: %d", rec.Code)
	}
	var resp struct {
		Providers []dimStat `json:"providers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return resp.Providers
}

// createTokenEvents 建最小 token_events 表（loadDimStats 依赖）。
func createTokenEvents(t *testing.T, a *API) {
	t.Helper()
	_, err := a.db.Exec(`CREATE TABLE token_events (
		event_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, session_id TEXT NOT NULL DEFAULT '',
		provider TEXT NOT NULL DEFAULT '', agent TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
		prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0,
		total_tokens INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0,
		timestamp TEXT NOT NULL, api_key_hash TEXT NOT NULL DEFAULT '', partial INTEGER NOT NULL DEFAULT 0)`)
	if err != nil {
		t.Fatal(err)
	}
}

// TestProvidersIncludesZeroUsageBuiltin 零用量的内置路由也在 /api/providers 列表中：
// UI 交叉核验「已接入」依赖全量列表，只看用量聚合会把没用过的预设误标「未接入」。
func TestProvidersIncludesZeroUsageBuiltin(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)

	stats := getProviders(t, a)
	builtin := adapter.BuiltinProviders()
	if len(stats) != len(builtin) {
		t.Fatalf("expected %d providers (all builtin), got %d", len(builtin), len(stats))
	}
	byName := map[string]dimStat{}
	for _, st := range stats {
		byName[st.Name] = st
	}
	for _, slug := range builtin {
		st, ok := byName[slug]
		if !ok {
			t.Fatalf("builtin slug %q missing from /api/providers", slug)
		}
		if st.Custom {
			t.Fatalf("builtin slug %q must not carry custom flag", slug)
		}
		if st.Tokens != 0 || st.Requests != 0 {
			t.Fatalf("zero-usage builtin %q should have zero values: %+v", slug, st)
		}
	}
}

// TestProvidersUnionUsageAndCustom 左并集：有用量的条目排前且数值保留；
// 零用量内置补齐；自定义供应商零值条目带 custom 标记。
func TestProvidersUnionUsageAndCustom(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)
	if _, err := a.db.Exec(`INSERT INTO token_events
		(event_id, project_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, timestamp)
		VALUES ('e1', 'p1', 'deepseek', 'claude-code', 'deepseek-chat', 100, 50, 150, '2026-08-10 10:00:00.000')`); err != nil {
		t.Fatal(err)
	}
	if code := postCustomProvider(t, a,
		`{"slug":"my-corp","name":"公司网关","baseUrl":"https://llm.corp.example.com/v1","protocol":"openai"}`); code != http.StatusOK {
		t.Fatalf("create custom: %d", code)
	}

	stats := getProviders(t, a)
	builtin := adapter.BuiltinProviders()
	if len(stats) != len(builtin)+1 {
		t.Fatalf("expected %d providers (builtin + 1 custom), got %d", len(builtin)+1, len(stats))
	}
	byName := map[string]dimStat{}
	for _, st := range stats {
		byName[st.Name] = st
	}
	ds, ok := byName["deepseek"]
	if !ok || ds.Tokens != 150 || ds.Requests != 1 || ds.Custom {
		t.Fatalf("usage entry broken: %+v", ds)
	}
	mc, ok := byName["my-corp"]
	if !ok || !mc.Custom || mc.Tokens != 0 {
		t.Fatalf("custom zero-value entry broken: %+v", mc)
	}
	// 有用量的排最前（loadDimStats 按 tokens 降序，零值补齐在尾部）
	if stats[0].Name != "deepseek" {
		t.Fatalf("usage entry should rank first, got %q", stats[0].Name)
	}
	// 新增的内置第三方路由也在列
	for _, slug := range []string{"packyapi", "apito", "claudecn", "therouter"} {
		if _, ok := byName[slug]; !ok {
			t.Fatalf("new third-party route %q missing", slug)
		}
	}
}
