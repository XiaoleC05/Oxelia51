package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// WeatherHandler 后端代理 Open-Meteo 天气 API，避免浏览器直连的 CORS/DNS 问题。
type WeatherHandler struct {
	rdb *redis.Client
	hc  *http.Client
}

func NewWeatherHandler(rdb *redis.Client) *WeatherHandler {
	return &WeatherHandler{
		rdb: rdb,
		hc:  &http.Client{Timeout: 10 * time.Second},
	}
}

type weatherResponse struct {
	City  string `json:"city"`
	Temp  int    `json:"temp"`
	Icon  string `json:"icon"`
	Label string `json:"label"`
}

type weatherCitiesResponse struct {
	Cities []weatherResponse `json:"cities"`
}

// cities 6 个代表性城市坐标
var cities = []struct {
	Name string
	Lat  float64
	Lon  float64
}{
	{"北京", 39.90, 116.40},
	{"上海", 31.23, 121.47},
	{"广州", 23.13, 113.26},
	{"成都", 30.57, 104.06},
	{"哈尔滨", 45.80, 126.53},
	{"乌鲁木齐", 43.79, 87.58},
}

// wmoMap Open-Meteo WMO 天气码 → 图标 + 中文标签
var wmoMap = map[int][2]string{
	0: {"☀️", "晴天"}, 1: {"🌤️", "少云"}, 2: {"⛅", "多云"}, 3: {"☁️", "阴"},
	45: {"🌫️", "雾"}, 48: {"🌫️", "雾凇"},
	51: {"🌧️", "小雨"}, 53: {"🌧️", "毛毛雨"}, 55: {"🌧️", "毛毛雨"},
	61: {"🌧️", "小雨"}, 63: {"🌧️", "中雨"}, 65: {"🌧️", "大雨"},
	71: {"❄️", "小雪"}, 73: {"❄️", "中雪"}, 75: {"❄️", "大雪"}, 77: {"❄️", "雪粒"},
	80: {"🌦️", "阵雨"}, 81: {"🌦️", "阵雨"}, 82: {"🌦️", "强阵雨"},
	85: {"❄️", "阵雪"}, 86: {"❄️", "阵雪"},
	95: {"⛈️", "雷暴"}, 96: {"⛈️", "冰雹雷暴"}, 99: {"⛈️", "强雷暴"},
}

func (h *WeatherHandler) GetWeather(c *gin.Context) {
	ctx := c.Request.Context()

	// 1) 检查全量缓存
	cacheKey := "weather:cities:v1"
	if cached, err := h.rdb.Get(ctx, cacheKey).Result(); err == nil {
		var resp weatherCitiesResponse
		if json.Unmarshal([]byte(cached), &resp) == nil {
			c.JSON(http.StatusOK, resp)
			return
		}
	}

	// 2) 并发查询 6 城市天气
	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		results []weatherResponse
	)

	for _, city := range cities {
		wg.Add(1)
		go func(city struct {
			Name string
			Lat  float64
			Lon  float64
		}) {
			defer wg.Done()
			wr := fetchCityWeather(ctx, h.hc, city.Name, city.Lat, city.Lon)
			mu.Lock()
			results = append(results, wr)
			mu.Unlock()
		}(city)
	}
	wg.Wait()

	resp := weatherCitiesResponse{Cities: results}

	// 3) 写缓存（30 分钟）
	payload, _ := json.Marshal(resp)
	h.rdb.Set(ctx, cacheKey, payload, 30*time.Minute)

	c.JSON(http.StatusOK, resp)
}

// fetchCityWeather 查询单个城市的天气（不涉及缓存）
func fetchCityWeather(ctx context.Context, hc *http.Client, name string, lat, lon float64) weatherResponse {
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,weather_code",
		lat, lon,
	)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return weatherResponse{City: name, Temp: 0, Icon: "🌡️", Label: "不可用"}
	}
	resp, err := hc.Do(req)
	if err != nil {
		return weatherResponse{City: name, Temp: 0, Icon: "🌡️", Label: "不可用"}
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return weatherResponse{City: name, Temp: 0, Icon: "🌡️", Label: "不可用"}
	}

	var data struct {
		Current struct {
			Temperature float64 `json:"temperature_2m"`
			WeatherCode int     `json:"weather_code"`
		} `json:"current"`
	}
	if json.NewDecoder(resp.Body).Decode(&data) != nil {
		return weatherResponse{City: name, Temp: 0, Icon: "🌡️", Label: "不可用"}
	}

	mapped, ok := wmoMap[data.Current.WeatherCode]
	if !ok {
		mapped = [2]string{"🌡️", "未知"}
	}
	return weatherResponse{
		City:  name,
		Temp:  int(data.Current.Temperature + 0.5),
		Icon:  mapped[0],
		Label: mapped[1],
	}
}
