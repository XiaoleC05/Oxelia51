package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

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
	if _, ok := body["go_goroutines"]; !ok {
		t.Error("missing go_goroutines")
	}
	if _, ok := body["go_alloc_mb"]; !ok {
		t.Error("missing go_alloc_mb")
	}
}

func TestFetchRemoteStats_InvalidURL(t *testing.T) {
	h := NewStatsHandler()
	_, err := h.fetchRemoteStats("ftp://localhost/stats")
	if err == nil {
		t.Error("expected error for ftp scheme")
	}
	_, err = h.fetchRemoteStats("http://evil.com/stats")
	if err == nil {
		t.Error("expected error for untrusted host")
	}
}

func TestFetchRemoteStats_Success(t *testing.T) {
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
