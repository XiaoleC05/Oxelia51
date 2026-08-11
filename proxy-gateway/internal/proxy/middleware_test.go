package proxy

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestKeyAuthOptional_NoKey_AnonymousProject 锁住 optional 模式无密钥请求的项目归并：
// 客户端自填的 X-Project-ID 必须被忽略（可伪造，会把用量记到任意项目头上），
// 统一归并到固定匿名项目。
func TestKeyAuthOptional_NoKey_AnonymousProject(t *testing.T) {
	var gotCtxProject, gotHeaderProject string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotCtxProject = projectIDFromContext(r.Context())
		gotHeaderProject = r.Header.Get("X-Project-ID")
	})
	// &KeyStore{}：pool 为 nil，无密钥分支不触达 Resolve，模拟云端 optional 部署
	h := keyAuth(&KeyStore{}, "optional")(next)

	req := httptest.NewRequest(http.MethodPost, "/api/proxy/openai/v1/chat/completions", nil)
	req.Header.Set("X-Project-ID", "victim-project")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if gotCtxProject != anonymousProjectID {
		t.Errorf("context project = %q, want %q", gotCtxProject, anonymousProjectID)
	}
	if gotHeaderProject != anonymousProjectID {
		t.Errorf("X-Project-ID header = %q, want %q（客户端伪造值必须被覆盖）", gotHeaderProject, anonymousProjectID)
	}
}

// TestKeyAuthRequired_NoKey_Rejected required 模式无密钥仍 401（行为不受匿名归并影响）。
func TestKeyAuthRequired_NoKey_Rejected(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("next should not be called")
	})
	h := keyAuth(&KeyStore{}, "required")(next)

	req := httptest.NewRequest(http.MethodPost, "/api/proxy/openai/v1/chat/completions", nil)
	req.Header.Set("X-Project-ID", "any")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
