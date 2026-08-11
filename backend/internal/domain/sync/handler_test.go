package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// TestUploadEventsLimit 锁住 events 数组上限：超过 maxUploadEvents 直接 400，
// 在解析入库前拦截（超大 body + 无上限曾是内存 DoS 面）。
// 超限分支在 repo 之前返回，故 nil pool 安全。
func TestUploadEventsLimit(t *testing.T) {
	h := NewHandler(nil)

	events := make([]SyncEvent, maxUploadEvents+1)
	for i := range events {
		events[i].EventID = fmt.Sprintf("e%d", i)
		events[i].DeviceID = "d1"
	}
	body, err := json.Marshal(map[string]any{"deviceId": "d1", "events": events})
	if err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/sync/upload", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userID", int64(1))

	h.Upload(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

// TestUploadUnauthorized 未注入 userID 时 401（鉴权中间件缺失的防御）。
func TestUploadUnauthorized(t *testing.T) {
	h := NewHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/sync/upload",
		bytes.NewReader([]byte(`{"deviceId":"d1","events":[]}`)))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Upload(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}
