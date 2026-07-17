package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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

	// 1) 检查 Redis 缓存（key 用客户端 IP，30 分钟粒度）
	ip := c.ClientIP()
	cacheKey := fmt.Sprintf("weather:%s", ip)

	if cached, err := h.rdb.Get(ctx, cacheKey).Result(); err == nil {
		var resp weatherResponse
		if json.Unmarshal([]byte(cached), &resp) == nil {
			c.JSON(http.StatusOK, resp)
			return
		}
	}

	// 2) 默认坐标（青岛），后续可扩展 IP 地理位置库
	lat := 36.06
	lon := 120.38

	// 3) 调 Open-Meteo（服务端无 CORS 限制）
	weatherURL := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,weather_code",
		lat, lon,
	)
	req, err := http.NewRequestWithContext(ctx, "GET", weatherURL, nil)
	if err != nil {
		log.Printf("weather: create request failed: %v", err)
		c.JSON(http.StatusOK, weatherResponse{City: "未知", Temp: 0, Icon: "🌡️", Label: "不可用"})
		return
	}
	resp, err := h.hc.Do(req)
	if err != nil {
		log.Printf("weather: request open-meteo failed: %v", err)
		c.JSON(http.StatusOK, weatherResponse{City: "未知", Temp: 0, Icon: "🌡️", Label: "不可用"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("weather: open-meteo returned status %d", resp.StatusCode)
		c.JSON(http.StatusOK, weatherResponse{City: "未知", Temp: 0, Icon: "🌡️", Label: "不可用"})
		return
	}

	var data struct {
		Current struct {
			Temperature float64 `json:"temperature_2m"`
			WeatherCode int     `json:"weather_code"`
		} `json:"current"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("weather: decode response failed: %v", err)
		c.JSON(http.StatusOK, weatherResponse{City: "未知", Temp: 0, Icon: "🌡️", Label: "不可用"})
		return
	}

	// 4) 映射天气码
	mapped, ok := wmoMap[data.Current.WeatherCode]
	if !ok {
		mapped = [2]string{"🌡️", "未知"}
	}
	icon, label := mapped[0], mapped[1]

	result := weatherResponse{
		City:  "本地",
		Temp:  int(data.Current.Temperature + 0.5),
		Icon:  icon,
		Label: label,
	}

	// 5) 写 Redis 缓存（30 分钟）
	payload, _ := json.Marshal(result)
	h.rdb.Set(ctx, cacheKey, payload, 30*time.Minute)

	c.JSON(http.StatusOK, result)
}
