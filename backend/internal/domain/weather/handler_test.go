package weather

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { rdb.Close() })
	return mr, rdb
}

func TestGetWeather_CacheHit(t *testing.T) {
	mr, rdb := newTestRedis(t)
	cached := weatherCitiesResponse{
		Cities: []weatherResponse{
			{City: "北京", Temp: 25, Icon: "☀️", Label: "晴天"},
			{City: "上海", Temp: 22, Icon: "⛅", Label: "多云"},
		},
	}
	payload, _ := json.Marshal(cached)
	mr.Set("weather:cities:v1", string(payload))

	h := NewWeatherHandler(rdb)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/weather", nil)
	h.GetWeather(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp weatherCitiesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Cities) != 2 {
		t.Fatalf("cities len = %d, want 2", len(resp.Cities))
	}
}

func TestGetWeather_NoCache_ReturnsSixCities(t *testing.T) {
	_, rdb := newTestRedis(t)
	h := NewWeatherHandler(rdb)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/weather", nil)
	h.GetWeather(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp weatherCitiesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Cities) != 6 {
		t.Fatalf("cities len = %d, want 6", len(resp.Cities))
	}
}

func TestFetchCityWeather_CancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	hc := &http.Client{Timeout: 5 * time.Second}
	result := fetchCityWeather(ctx, hc, "测试城市", 39.90, 116.40)
	if result.City != "测试城市" {
		t.Errorf("City = %q, want 测试城市", result.City)
	}
	if result.Icon != "🌡️" {
		t.Errorf("Icon = %q, want 🌡️", result.Icon)
	}
}

func TestWmoMap_Coverage(t *testing.T) {
	codes := []int{0, 1, 2, 3, 45, 51, 61, 71, 80, 95}
	for _, code := range codes {
		mapped, ok := wmoMap[code]
		if !ok {
			t.Errorf("wmoMap missing code %d", code)
			continue
		}
		if mapped[0] == "" || mapped[1] == "" {
			t.Errorf("wmoMap[%d] has empty icon or label", code)
		}
	}
}

func TestCities_HasSixEntries(t *testing.T) {
	if len(cities) != 6 {
		t.Fatalf("cities len = %d, want 6", len(cities))
	}
}
