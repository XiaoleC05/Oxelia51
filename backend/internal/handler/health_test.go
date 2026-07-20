package handler

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

// testDBPool 尝试连接测试数据库，不可用时跳过测试
func testDBPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		// 使用默认本地开发 DSN（docker compose up）
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
	if body["database"] != true {
		t.Errorf("database = %v, want true", body["database"])
	}
	if _, ok := body["timestamp"]; !ok {
		t.Error("missing timestamp field")
	}
}

func TestHealth_Degraded(t *testing.T) {
	// 使用无效 DSN 创建连接池（不会立即报错，但 Ping 会失败）
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

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "degraded" {
		t.Errorf("status = %v, want degraded", body["status"])
	}
	if body["database"] != false {
		t.Errorf("database = %v, want false", body["database"])
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
	// 应包含 days 和 hours 字段
	if _, ok := body["days"]; !ok {
		t.Error("missing days field")
	}
	if _, ok := body["hours"]; !ok {
		t.Error("missing hours field")
	}
}

func TestUptime_NoSettings(t *testing.T) {
	// 使用无效连接 → QueryRow 失败 → 返回 days:0, hours:0
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

// --- StatsHandler 测试（无需 DB）---

func TestServerStats_ReturnsOK(t *testing.T) {
	h := NewStatsHandler()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/stats/server", nil)

	h.ServerStats(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// 必须包含 Go 运行时指标
	if _, ok := body["go_goroutines"]; !ok {
		t.Error("missing go_goroutines")
	}
	if _, ok := body["go_alloc_mb"]; !ok {
		t.Error("missing go_alloc_mb")
	}
}

func TestFetchRemoteStats_InvalidURL(t *testing.T) {
	h := NewStatsHandler()

	// 无效 scheme
	_, err := h.fetchRemoteStats("ftp://localhost/stats")
	if err == nil {
		t.Error("expected error for ftp scheme")
	}

	// 不受信任的 host
	_, err = h.fetchRemoteStats("http://evil.com/stats")
	if err == nil {
		t.Error("expected error for untrusted host")
	}
}

func TestFetchRemoteStats_Success(t *testing.T) {
	// 启动本地测试服务器（localhost 在白名单中）
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"cpu_percent":    42.5,
			"memory_used_mb": 1024,
		})
	}))
	defer ts.Close()

	h := NewStatsHandler()
	stats, err := h.fetchRemoteStats(ts.URL)
	if err != nil {
		t.Fatalf("fetchRemoteStats: %v", err)
	}
	if stats == nil {
		t.Fatal("stats is nil")
	}
	if stats.CPUPercent != 42.5 {
		t.Errorf("CPUPercent = %f, want 42.5", stats.CPUPercent)
	}
	if stats.MemoryUsedMB != 1024 {
		t.Errorf("MemoryUsedMB = %d, want 1024", stats.MemoryUsedMB)
	}
}

func TestFetchRemoteStats_Non200(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts.Close()

	h := NewStatsHandler()
	stats, err := h.fetchRemoteStats(ts.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stats != nil {
		t.Error("expected nil stats for non-200 response")
	}
}

func TestParseMeminfoKB(t *testing.T) {
	cases := []struct {
		line string
		want uint64
	}{
		{"MemTotal:       16384000 kB", 16384000},
		{"MemAvailable:   8192000 kB", 8192000},
		{"Short", 0},
		{"", 0},
	}
	for _, tc := range cases {
		got := parseMeminfoKB(tc.line)
		if got != tc.want {
			t.Errorf("parseMeminfoKB(%q) = %d, want %d", tc.line, got, tc.want)
		}
	}
}

func TestCPUSample_Methods(t *testing.T) {
	s := &cpuSample{
		user: 100, nice: 10, system: 50, idle: 800,
		iowait: 20, irq: 5, softirq: 3, steal: 2,
	}

	wantTotal := uint64(100 + 10 + 50 + 800 + 20 + 5 + 3 + 2)
	if s.total() != wantTotal {
		t.Errorf("total() = %d, want %d", s.total(), wantTotal)
	}

	wantIdle := uint64(800 + 20)
	if s.idleTotal() != wantIdle {
		t.Errorf("idleTotal() = %d, want %d", s.idleTotal(), wantIdle)
	}
}
