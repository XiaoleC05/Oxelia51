package handler

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

// newTestRedis 启动 miniredis 并返回 redis.Client
func newTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { rdb.Close() })
	return mr, rdb
}

func TestGetWeather_CacheHit(t *testing.T) {
	mr, rdb := newTestRedis(t)

	// 预填缓存
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
	if resp.Cities[0].City != "北京" || resp.Cities[0].Temp != 25 {
		t.Errorf("unexpected city data: %+v", resp.Cities[0])
	}
}

func TestGetWeather_CacheHit_InvalidJSON(t *testing.T) {
	mr, rdb := newTestRedis(t)

	// 缓存中放入无效 JSON → 应跳过缓存走正常查询
	mr.Set("weather:cities:v1", "not-valid-json{{{")

	h := NewWeatherHandler(rdb)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/weather", nil)

	h.GetWeather(c)

	// 无论网络是否可用，都应返回 200（降级策略）
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

	// 每个城市必须有 city 名称
	for i, city := range resp.Cities {
		if city.City == "" {
			t.Errorf("cities[%d].City is empty", i)
		}
	}
}

func TestGetWeather_WritesCache(t *testing.T) {
	mr, rdb := newTestRedis(t)

	h := NewWeatherHandler(rdb)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/weather", nil)

	h.GetWeather(c)

	// 验证缓存已写入
	cached, err := mr.Get("weather:cities:v1")
	if err != nil {
		t.Fatalf("cache not written: %v", err)
	}
	var resp weatherCitiesResponse
	if json.Unmarshal([]byte(cached), &resp) != nil {
		t.Fatal("cached data is not valid JSON")
	}
	if len(resp.Cities) != 6 {
		t.Fatalf("cached cities len = %d, want 6", len(resp.Cities))
	}
}

func TestFetchCityWeather_CancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // 立即取消

	hc := &http.Client{Timeout: 5 * time.Second}
	result := fetchCityWeather(ctx, hc, "测试城市", 39.90, 116.40)

	if result.City != "测试城市" {
		t.Errorf("City = %q, want 测试城市", result.City)
	}
	if result.Temp != 0 {
		t.Errorf("Temp = %d, want 0", result.Temp)
	}
	if result.Icon != "🌡️" {
		t.Errorf("Icon = %q, want 🌡️", result.Icon)
	}
	if result.Label != "不可用" {
		t.Errorf("Label = %q, want 不可用", result.Label)
	}
}

func TestFetchCityWeather_Success(t *testing.T) {
	if testing.Short() {
		t.Skip("跳过网络集成测试 (short mode)")
	}

	ctx := context.Background()
	hc := &http.Client{Timeout: 10 * time.Second}
	result := fetchCityWeather(ctx, hc, "北京", 39.90, 116.40)

	if result.City != "北京" {
		t.Errorf("City = %q, want 北京", result.City)
	}
	// 真实 API 应返回有效数据（非降级）
	if result.Label == "不可用" {
		t.Skip("Open-Meteo API 不可达，跳过")
	}
	if result.Icon == "" {
		t.Error("Icon should not be empty")
	}
}

func TestWmoMap_Coverage(t *testing.T) {
	// 验证关键天气码都有映射
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
	for i, c := range cities {
		if c.Name == "" {
			t.Errorf("cities[%d].Name is empty", i)
		}
		if c.Lat == 0 && c.Lon == 0 {
			t.Errorf("cities[%d] has zero coordinates", i)
		}
	}
}
