package tool

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func testDBPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://root:@Wo4geshabi@localhost:5432/oxelia51?sslmode=disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Skipf("跳过: 无法创建连接池: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("跳过: PostgreSQL 不可达: %v", err)
	}
	t.Cleanup(func() { pool.Close() })
	return pool
}

func TestListTools(t *testing.T) {
	db := testDBPool(t)
	h := NewToolHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/tools", nil)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var items []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for i, item := range items {
		if item["slug"] == nil || item["slug"] == "" {
			t.Errorf("items[%d] missing slug", i)
		}
	}
}

func TestGetTool_NotFound(t *testing.T) {
	db := testDBPool(t)
	h := NewToolHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/tools/nonexistent-tool-xyz", nil)
	c.Params = gin.Params{{Key: "slug", Value: "nonexistent-tool-xyz"}}
	h.Get(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "TOOL_NOT_FOUND" {
		t.Errorf("code = %v, want TOOL_NOT_FOUND", body["code"])
	}
}
