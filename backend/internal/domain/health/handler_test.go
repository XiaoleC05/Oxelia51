package health

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
		t.Skip("TEST_DATABASE_URL not set, skipping DB test")
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

func TestHealth_OK(t *testing.T) {
	db := testDBPool(t)
	h := NewHealthHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/health", nil)
	h.Health(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %v, want ok", body["status"])
	}
}

func TestHealth_Degraded(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, "postgres://invalid:invalid@192.0.2.1:1/nonexist?sslmode=disable&connect_timeout=1")
	if err != nil {
		t.Skipf("跳过: 无法创建连接池: %v", err)
	}
	defer pool.Close()
	h := NewHealthHandler(pool)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/health", nil)
	h.Health(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", w.Code)
	}
}

func TestUptime_OK(t *testing.T) {
	db := testDBPool(t)
	h := NewHealthHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/uptime", nil)
	h.Uptime(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := body["days"]; !ok {
		t.Error("missing days field")
	}
}

func TestUptime_NoSettings(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, "postgres://invalid:invalid@192.0.2.1:1/nonexist?sslmode=disable&connect_timeout=1")
	if err != nil {
		t.Skipf("跳过: 无法创建连接池: %v", err)
	}
	defer pool.Close()
	h := NewHealthHandler(pool)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/uptime", nil)
	h.Uptime(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["days"] != float64(0) {
		t.Errorf("days = %v, want 0", body["days"])
	}
}
