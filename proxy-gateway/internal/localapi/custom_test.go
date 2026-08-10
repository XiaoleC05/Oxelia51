package localapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// postCustomProvider 走 POST /api/custom-providers 端点，返回 HTTP 状态码。
func postCustomProvider(t *testing.T, a *API, body string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/custom-providers", strings.NewReader(body))
	rec := httptest.NewRecorder()
	a.handleCustomProviders(rec, req)
	return rec.Code
}

// getCustomItems 走 GET /api/custom-providers 端点，返回 items 列表。
func getCustomItems(t *testing.T, a *API) []adapter.CustomProvider {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/custom-providers", nil)
	rec := httptest.NewRecorder()
	a.handleCustomProviders(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status: %d", rec.Code)
	}
	var resp struct {
		Items []adapter.CustomProvider `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("GET decode: %v", err)
	}
	return resp.Items
}

// deleteCustomProvider 走 POST /api/custom-providers/delete 端点，返回 HTTP 状态码。
func deleteCustomProvider(t *testing.T, a *API, slug string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/custom-providers/delete",
		strings.NewReader(`{"slug":"`+slug+`"}`))
	rec := httptest.NewRecorder()
	a.handleCustomProvidersDelete(rec, req)
	return rec.Code
}

// TestCustomProvidersCRUD 增删改查往返：新增 → 列表可见 → 同 slug upsert 更新 → 删除后消失。
func TestCustomProvidersCRUD(t *testing.T) {
	a := newTestAPI(t)

	// 空列表也应返回 [] 而非 null
	if items := getCustomItems(t, a); items == nil || len(items) != 0 {
		t.Fatalf("empty: expected non-nil empty items, got %v", items)
	}

	if code := postCustomProvider(t, a,
		`{"slug":"my-corp","name":"公司网关","baseUrl":"https://llm.corp.example.com/v1","protocol":"openai"}`); code != http.StatusOK {
		t.Fatalf("create: %d", code)
	}
	items := getCustomItems(t, a)
	if len(items) != 1 || items[0].Slug != "my-corp" || items[0].BaseURL != "https://llm.corp.example.com/v1" ||
		items[0].Name != "公司网关" || items[0].Protocol != "openai" {
		t.Fatalf("after create: %+v", items)
	}

	// 同 slug 再 POST = 更新（upsert），不新增条目
	if code := postCustomProvider(t, a,
		`{"slug":"my-corp","name":"公司网关2","baseUrl":"https://v2.corp.example.com","protocol":"anthropic"}`); code != http.StatusOK {
		t.Fatalf("upsert: %d", code)
	}
	items = getCustomItems(t, a)
	if len(items) != 1 || items[0].BaseURL != "https://v2.corp.example.com" || items[0].Protocol != "anthropic" {
		t.Fatalf("after upsert: %+v", items)
	}

	if code := deleteCustomProvider(t, a, "my-corp"); code != http.StatusOK {
		t.Fatalf("delete: %d", code)
	}
	if items := getCustomItems(t, a); len(items) != 0 {
		t.Fatalf("after delete: %+v", items)
	}
}

// TestCustomProvidersValidation 非法输入拒绝（400），内置 slug 冲突 409。
func TestCustomProvidersValidation(t *testing.T) {
	a := newTestAPI(t)

	cases := []struct {
		name string
		body string
		want int
	}{
		{"slug 大写", `{"slug":"MyCorp","name":"x","baseUrl":"https://a.com","protocol":"openai"}`, 400},
		{"slug 下划线", `{"slug":"my_corp","name":"x","baseUrl":"https://a.com","protocol":"openai"}`, 400},
		{"slug 单字符", `{"slug":"a","name":"x","baseUrl":"https://a.com","protocol":"openai"}`, 400},
		{"slug 超长", `{"slug":"` + strings.Repeat("a", 33) + `","name":"x","baseUrl":"https://a.com","protocol":"openai"}`, 400},
		{"内置冲突", `{"slug":"openai","name":"x","baseUrl":"https://a.com","protocol":"openai"}`, 409},
		{"http 非回环", `{"slug":"corp1","name":"x","baseUrl":"http://a.com","protocol":"openai"}`, 400},
		{"非 https 方案", `{"slug":"corp1","name":"x","baseUrl":"ftp://a.com","protocol":"openai"}`, 400},
		{"userinfo 拒绝", `{"slug":"corp1","name":"x","baseUrl":"https://key:secret@a.com","protocol":"openai"}`, 400},
		{"query 拒绝", `{"slug":"corp1","name":"x","baseUrl":"https://a.com/v1?x=1","protocol":"openai"}`, 400},
		{"尾部斜杠拒绝", `{"slug":"corp1","name":"x","baseUrl":"https://a.com/v1/","protocol":"openai"}`, 400},
		{"name 空", `{"slug":"corp1","name":"","baseUrl":"https://a.com","protocol":"openai"}`, 400},
		{"name 超长", `{"slug":"corp1","name":"` + strings.Repeat("名", 51) + `","baseUrl":"https://a.com","protocol":"openai"}`, 400},
		{"protocol 非法", `{"slug":"corp1","name":"x","baseUrl":"https://a.com","protocol":"gemini"}`, 400},
		{"http 回环放行", `{"slug":"corp1","name":"x","baseUrl":"http://127.0.0.1:8080/v1","protocol":"openai"}`, 200},
		{"localhost 放行", `{"slug":"corp2","name":"x","baseUrl":"http://localhost:9000","protocol":"anthropic"}`, 200},
	}
	for _, tc := range cases {
		if got := postCustomProvider(t, a, tc.body); got != tc.want {
			t.Errorf("%s: expected %d, got %d", tc.name, tc.want, got)
		}
	}
	if items := getCustomItems(t, a); len(items) != 2 {
		t.Fatalf("expected 2 accepted items, got %+v", items)
	}
}

// TestCustomProvidersDeleteBuiltin 内置 slug 不可删；删不存在的自定义幂等成功。
func TestCustomProvidersDeleteBuiltin(t *testing.T) {
	a := newTestAPI(t)
	if code := deleteCustomProvider(t, a, "deepseek"); code != http.StatusBadRequest {
		t.Fatalf("builtin delete: expected 400, got %d", code)
	}
	if code := deleteCustomProvider(t, a, "never-existed"); code != http.StatusOK {
		t.Fatalf("missing delete: expected 200, got %d", code)
	}
}

// newRegistryWithCustom 建挂了自定义源的 Registry（模拟 main 接线）。
func newRegistryWithCustom(a *API) *adapter.Registry {
	reg := adapter.NewRegistry()
	reg.SetCustomSource(a.CustomSource())
	return reg
}

// TestCustomProviderMatchMerge 静态表查无后回退自定义命中；校验 Route 字段与路径去重。
func TestCustomProviderMatchMerge(t *testing.T) {
	a := newTestAPI(t)
	reg := newRegistryWithCustom(a)

	// 未添加前 404（Match nil）
	if route, _ := reg.Match("/api/proxy/my-corp/v1/chat/completions"); route != nil {
		t.Fatalf("before add: expected nil, got %+v", route)
	}

	if code := postCustomProvider(t, a,
		`{"slug":"my-corp","name":"公司网关","baseUrl":"https://llm.corp.example.com/v1","protocol":"anthropic"}`); code != http.StatusOK {
		t.Fatalf("create: %d", code)
	}

	route, prefix := reg.Match("/api/proxy/my-corp/v1/messages")
	if route == nil {
		t.Fatal("after add: Match missed custom provider")
	}
	if prefix != "/api/proxy/my-corp/" {
		t.Fatalf("prefix: %q", prefix)
	}
	if route.Target != "llm.corp.example.com" || route.PathPrefix != "/v1" || route.Scheme != "https" {
		t.Fatalf("route: %+v", route)
	}
	if !route.Custom || !route.XAPIKeyAuth {
		t.Fatalf("anthropic custom should set Custom+XAPIKeyAuth: %+v", route)
	}
	if route.Adapter.ProviderName() != "my-corp" {
		t.Fatalf("provider name should be slug: %q", route.Adapter.ProviderName())
	}

	// 路径去重同内置：客户端带 /v1 前缀时不双拼
	if got := reg.ResolveTarget("/api/proxy/my-corp/v1/messages", prefix); got != "messages" {
		t.Fatalf("ResolveTarget dedup: %q", got)
	}

	// 内置路由不受影响
	builtin, _ := reg.Match("/api/proxy/openai/v1/chat/completions")
	if builtin == nil || builtin.Custom {
		t.Fatalf("builtin route broken: %+v", builtin)
	}

	// 删除后回落 404
	if code := deleteCustomProvider(t, a, "my-corp"); code != http.StatusOK {
		t.Fatalf("delete: %d", code)
	}
	if route, _ := reg.Match("/api/proxy/my-corp/v1/messages"); route != nil {
		t.Fatalf("after delete: expected nil, got %+v", route)
	}
}

// TestCustomProviderLoopbackHTTP http 回环自定义供应商的 Scheme 透传。
func TestCustomProviderLoopbackHTTP(t *testing.T) {
	a := newTestAPI(t)
	reg := newRegistryWithCustom(a)
	if code := postCustomProvider(t, a,
		`{"slug":"local-llm","name":"本机","baseUrl":"http://127.0.0.1:11434/v1","protocol":"openai"}`); code != http.StatusOK {
		t.Fatalf("create: %d", code)
	}
	route, _ := reg.Match("/api/proxy/local-llm/v1/chat/completions")
	if route == nil || route.Scheme != "http" || route.Target != "127.0.0.1:11434" || route.XAPIKeyAuth {
		t.Fatalf("route: %+v", route)
	}
}

// TestCustomProvidersCacheInvalidation 经 setSetting 直写后缓存主动失效，Match 立即可见（不等 TTL）。
func TestCustomProvidersCacheInvalidation(t *testing.T) {
	a := newTestAPI(t)
	reg := newRegistryWithCustom(a)

	a.setSetting(customProvidersKey,
		`[{"slug":"direct-write","name":"直写","baseUrl":"https://a.example.com","protocol":"openai"}]`)
	if route, _ := reg.Match("/api/proxy/direct-write/v1/chat"); route == nil {
		t.Fatal("after setSetting: custom provider not visible (cache not invalidated)")
	}

	// 绕过 setSetting 直改 DB：TTL 内仍命中旧缓存
	if _, err := a.db.Exec(`UPDATE settings SET value = '[]' WHERE key = ?`, customProvidersKey); err != nil {
		t.Fatal(err)
	}
	if route, _ := reg.Match("/api/proxy/direct-write/v1/chat"); route == nil {
		t.Fatal("within TTL: expected cached entry still visible")
	}
}
