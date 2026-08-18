package localapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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

// TestAgentAliases 锁住 #问题 4：agent_aliases 设置经白名单写入，Agent 聚合页
// 与供应商下钻均按别名展示，原始名在 token_events 不受影响。
func TestAgentAliases(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)
	if _, err := a.db.Exec(`INSERT INTO token_events
		(event_id, project_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, timestamp)
		VALUES ('e1', 'p1', 'deepseek', '其他', 'deepseek-chat', 100, 50, 150, '2026-08-10 10:00:00.000'),
		       ('e2', 'p1', 'deepseek', 'claude-code', 'deepseek-chat', 10, 5, 15, '2026-08-10 10:00:01.000')`); err != nil {
		t.Fatal(err)
	}

	// agent_aliases 必须在白名单内可写
	req := httptest.NewRequest(http.MethodPost, "/api/settings",
		strings.NewReader(`{"key":"agent_aliases","value":"{\"其他\":\"自建脚本\"}"}`))
	rec := httptest.NewRecorder()
	a.handleSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("write agent_aliases: %d", rec.Code)
	}
	if m := a.getAgentAliases(); m["其他"] != "自建脚本" {
		t.Fatalf("getAgentAliases = %v", m)
	}

	// GET /api/agents 应把「其他」显示为别名
	areq := httptest.NewRequest(http.MethodGet, "/api/agents", nil)
	arec := httptest.NewRecorder()
	a.handleAgents(arec, areq)
	var ar struct {
		Agents []dimStat `json:"agents"`
	}
	if err := json.Unmarshal(arec.Body.Bytes(), &ar); err != nil {
		t.Fatalf("decode agents: %v", err)
	}
	byName := map[string]dimStat{}
	for _, st := range ar.Agents {
		byName[st.Name] = st
	}
	if _, ok := byName["自建脚本"]; !ok {
		t.Fatalf("agent alias not applied, names: %v", ar.Agents)
	}
	// 未配置别名的 Agent 保持原始名
	if _, ok := byName["claude-code"]; !ok {
		t.Fatalf("unaliased agent lost: %v", ar.Agents)
	}

	// 供应商下钻里交叉维度 Agent 也应用别名
	preq := httptest.NewRequest(http.MethodGet, "/api/providers/deepseek", nil)
	prec := httptest.NewRecorder()
	a.handleProviderDetail(prec, preq)
	var pr struct {
		Rows []dimDetailRow `json:"rows"`
	}
	if err := json.Unmarshal(prec.Body.Bytes(), &pr); err != nil {
		t.Fatalf("decode provider detail: %v", err)
	}
	dimSeen := map[string]bool{}
	for _, r := range pr.Rows {
		dimSeen[r.Dim] = true
	}
	if !dimSeen["自建脚本"] {
		t.Fatalf("provider detail dim alias missing: %+v", pr.Rows)
	}
}

// TestAgentDetailAlias 锁住别名钻取：Agent 列表按显示名别名展示后，点别名条目
// 下钻 /api/agents/<别名> 必须反映射回原始名查到数据；未设别名按原名正常；
// 查不存在的名字返回空明细而非报错。
func TestAgentDetailAlias(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)
	if _, err := a.db.Exec(`INSERT INTO token_events
		(event_id, project_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, timestamp)
		VALUES ('e1', 'p1', 'deepseek', '其他', 'deepseek-chat', 100, 50, 150, '2026-08-10 10:00:00.000')`); err != nil {
		t.Fatal(err)
	}
	// 设别名：原始名「其他」→ 显示名「自建脚本」
	req := httptest.NewRequest(http.MethodPost, "/api/settings",
		strings.NewReader(`{"key":"agent_aliases","value":"{\"其他\":\"自建脚本\"}"}`))
	rec := httptest.NewRecorder()
	a.handleSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("write agent_aliases: %d", rec.Code)
	}

	getDetail := func(path string) (int, []dimDetailRow) {
		t.Helper()
		r := httptest.NewRequest(http.MethodGet, path, nil)
		w := httptest.NewRecorder()
		a.handleAgentDetail(w, r)
		var resp struct {
			Rows []dimDetailRow `json:"rows"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
		return w.Code, resp.Rows
	}

	// 按别名钻取：返回原始名「其他」的数据
	code, rows := getDetail("/api/agents/自建脚本")
	if code != http.StatusOK || len(rows) != 1 || rows[0].Tokens != 150 {
		t.Fatalf("alias drill broken: code=%d rows=%+v", code, rows)
	}
	// 未设别名的名字按原名直查（无数据，空明细而非报错）
	code, rows = getDetail("/api/agents/claude-code")
	if code != http.StatusOK || len(rows) != 0 {
		t.Fatalf("unaliased drill broken: code=%d rows=%+v", code, rows)
	}
	// 不存在的名字：空明细、不报错
	code, rows = getDetail("/api/agents/no-such-agent")
	if code != http.StatusOK || len(rows) != 0 {
		t.Fatalf("unknown agent should be empty 200: code=%d rows=%+v", code, rows)
	}

	// 删除别名后按原名钻取恢复正常
	req = httptest.NewRequest(http.MethodPost, "/api/settings",
		strings.NewReader(`{"key":"agent_aliases","value":"{}"}`))
	rec = httptest.NewRecorder()
	a.handleSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("clear agent_aliases: %d", rec.Code)
	}
	code, rows = getDetail("/api/agents/其他")
	if code != http.StatusOK || len(rows) != 1 || rows[0].Tokens != 150 {
		t.Fatalf("original-name drill after alias removal broken: code=%d rows=%+v", code, rows)
	}
}

// TestModelsEndpoint 锁住 /api/models：按模型聚合，支持 ?days=N（总览「按模型」排行联动）。
func TestModelsEndpoint(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)
	if _, err := a.db.Exec(`INSERT INTO token_events
		(event_id, project_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, timestamp)
		VALUES ('e1', 'p1', 'deepseek', 'claude-code', 'deepseek-chat', 100, 50, 150, '2026-08-10 10:00:00.000'),
		       ('e2', 'p1', 'deepseek', 'claude-code', 'deepseek-v4-flash', 20, 10, 30, '2026-08-10 10:00:01.000')`); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/models", nil)
	rec := httptest.NewRecorder()
	a.handleModels(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/models status: %d", rec.Code)
	}
	var resp struct {
		Models []dimStat `json:"models"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	byName := map[string]dimStat{}
	for _, m := range resp.Models {
		byName[m.Name] = m
	}
	if dc, ok := byName["deepseek-chat"]; !ok || dc.Tokens != 150 || dc.Requests != 1 {
		t.Fatalf("model deepseek-chat entry broken: %+v", dc)
	}
	if df, ok := byName["deepseek-v4-flash"]; !ok || df.Tokens != 30 {
		t.Fatalf("model deepseek-v4-flash entry broken: %+v", df)
	}
}

// TestModelNameNormalization 锁住 #排行模型名不规范：上下文窗口后缀（[1M]/[2M]）
// 在 /api/models 聚合与明细下钻中归一为同一条基础模型名。
func TestModelNameNormalization(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)
	if _, err := a.db.Exec(`INSERT INTO token_events
		(event_id, project_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, timestamp)
		VALUES ('e1', 'p1', 'deepseek', 'claude-code', 'deepseek-v4-flash', 100, 50, 150, '2026-08-10 10:00:00.000'),
		       ('e2', 'p1', 'deepseek', 'claude-code', 'deepseek-v4-flash[1M]', 20, 10, 30, '2026-08-10 10:00:01.000'),
		       ('e3', 'p1', 'deepseek', 'claude-code', 'deepseek-v4-pro[2M]', 5, 3, 8, '2026-08-10 10:00:02.000')`); err != nil {
		t.Fatal(err)
	}

	// /api/models：flash 的 [1M] 变体并入基础名（150+30=180），pro 的 [2M] 归到 pro
	req := httptest.NewRequest(http.MethodGet, "/api/models", nil)
	rec := httptest.NewRecorder()
	a.handleModels(rec, req)
	var resp struct {
		Models []dimStat `json:"models"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode models: %v", err)
	}
	byName := map[string]dimStat{}
	for _, m := range resp.Models {
		byName[m.Name] = m
	}
	if df, ok := byName["deepseek-v4-flash"]; !ok || df.Tokens != 180 {
		t.Fatalf("flash normalized: expected 180 tokens, got %+v", df)
	}
	if _, ok := byName["deepseek-v4-flash[1M]"]; ok {
		t.Fatalf("[1M] variant should be merged into base name: %+v", byName)
	}
	if dp, ok := byName["deepseek-v4-pro"]; !ok || dp.Tokens != 8 {
		t.Fatalf("pro normalized: expected 8 tokens, got %+v", dp)
	}
	if _, ok := byName["deepseek-v4-pro[2M]"]; ok {
		t.Fatalf("[2M] variant should be merged into base name")
	}

	// 供应商下钻明细：model 列同样归一化
	preq := httptest.NewRequest(http.MethodGet, "/api/providers/deepseek", nil)
	prec := httptest.NewRecorder()
	a.handleProviderDetail(prec, preq)
	var pr struct {
		Rows []dimDetailRow `json:"rows"`
	}
	if err := json.Unmarshal(prec.Body.Bytes(), &pr); err != nil {
		t.Fatalf("decode provider detail: %v", err)
	}
	modelSeen := map[string]int64{}
	for _, r := range pr.Rows {
		modelSeen[r.Model] += r.Tokens
	}
	if modelSeen["deepseek-v4-flash"] != 180 {
		t.Fatalf("detail flash normalized: expected 180, got %+v", modelSeen)
	}
	if _, ok := modelSeen["deepseek-v4-flash[1M]"]; ok {
		t.Fatalf("detail [1M] variant should be merged: %+v", modelSeen)
	}
}

// ---------- P2-2：days 过滤本地时区口径 ----------

// TestDaysFilterLocaltime 锁住 P2-2：token_events.timestamp 存本地时间字符串，
// days 过滤必须用 datetime('now','localtime',...)，否则 UTC/本地边界偏移 ~8h。
// 用 localtime 语义构造边界：本地 cutoff 两侧各插一行，只有内侧的应被统计。
func TestDaysFilterLocaltime(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)

	const layout = "2006-01-02 15:04:05.000"
	cutoff := time.Now().AddDate(0, 0, -2) // days=2 的本地 cutoff
	inside := cutoff.Add(time.Hour).Format(layout)
	outside := cutoff.Add(-time.Hour).Format(layout)
	if _, err := a.db.Exec(`INSERT INTO token_events
		(event_id, project_id, provider, agent, model, prompt_tokens, completion_tokens, total_tokens, timestamp)
		VALUES ('in', 'p1', 'deepseek', 'claude-code', 'deepseek-chat', 10, 5, 15, ?),
		       ('out', 'p1', 'deepseek', 'claude-code', 'deepseek-chat', 20, 10, 30, ?)`,
		inside, outside); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/models?days=2", nil)
	rec := httptest.NewRecorder()
	a.handleModels(rec, req)
	var resp struct {
		Models []dimStat `json:"models"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Models) != 1 || resp.Models[0].Tokens != 15 || resp.Models[0].Requests != 1 {
		t.Fatalf("days=2 local boundary broken: %+v", resp.Models)
	}

	// 子句本身必须带 localtime 修饰符（防回退）
	clause, _ := daysFilter(httptest.NewRequest(http.MethodGet, "/x?days=7", nil))
	if !strings.Contains(clause, "localtime") {
		t.Fatalf("daysFilter clause missing localtime: %q", clause)
	}
}

// ---------- P2-4：budgets ≤0 读侧不触发 + 写侧拒绝 ----------

// TestBudgetsWriteValidation 锁住 P2-4 写侧：dailyTokens 非正整数一律 400。
func TestBudgetsWriteValidation(t *testing.T) {
	post := func(a *API, value string) int {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"key": "budgets", "value": value})
		req := httptest.NewRequest(http.MethodPost, "/api/settings", strings.NewReader(string(body)))
		rec := httptest.NewRecorder()
		a.handleSettings(rec, req)
		return rec.Code
	}

	a := newTestAPI(t)
	if code := post(a, `[{"dimension":"global","dailyTokens":0}]`); code != http.StatusBadRequest {
		t.Fatalf("dailyTokens=0 should be 400, got %d", code)
	}
	if code := post(a, `[{"dimension":"global","dailyTokens":-100}]`); code != http.StatusBadRequest {
		t.Fatalf("dailyTokens=-100 should be 400, got %d", code)
	}
	if code := post(a, `[{"dimension":"global","dailyTokens":1.5}]`); code != http.StatusBadRequest {
		t.Fatalf("dailyTokens=1.5 should be 400, got %d", code)
	}
	if code := post(a, `{"not":"a list"}`); code != http.StatusBadRequest {
		t.Fatalf("non-array budgets should be 400, got %d", code)
	}
	if code := post(a, `[{"dimension":"global","dailyTokens":1000}]`); code != http.StatusOK {
		t.Fatalf("valid budgets should be 200, got %d", code)
	}
	// 空数组合法（清空预算）
	if code := post(a, `[]`); code != http.StatusOK {
		t.Fatalf("empty budgets should be 200, got %d", code)
	}
}

// TestAlertsSkipsNonPositiveBudgets 锁住 P2-4 读侧：DailyTokens ≤0 的历史脏数据
// 不参与触发、不出现在使用区（AlertsTab 使用区直接渲染 alerts 列表）。
func TestAlertsSkipsNonPositiveBudgets(t *testing.T) {
	a := newTestAPI(t)
	createTokenEvents(t, a)
	// 直写 DB 模拟历史脏数据（绕开写侧校验）
	if err := a.setSetting("budgets", `[
		{"dimension":"global","dailyTokens":0},
		{"dimension":"provider","target":"deepseek","dailyTokens":-5},
		{"dimension":"model","target":"deepseek-chat","dailyTokens":100}
	]`); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/alerts", nil)
	rec := httptest.NewRecorder()
	a.handleAlerts(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/alerts status: %d", rec.Code)
	}
	var resp struct {
		Alerts []struct {
			Dimension   string `json:"dimension"`
			Target      string `json:"target"`
			DailyTokens int64  `json:"dailyTokens"`
			Triggered   bool   `json:"triggered"`
		} `json:"alerts"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Alerts) != 1 {
		t.Fatalf("non-positive budgets must be filtered, got %+v", resp.Alerts)
	}
	al := resp.Alerts[0]
	if al.Dimension != "model" || al.Target != "deepseek-chat" || al.DailyTokens != 100 {
		t.Fatalf("wrong alert kept: %+v", al)
	}
	if al.Triggered {
		t.Fatalf("zero usage against 100 budget must not trigger: %+v", al)
	}
}
