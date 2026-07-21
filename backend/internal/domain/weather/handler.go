package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
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
	transport := &http.Transport{
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 6,
		IdleConnTimeout:     90 * time.Second,
	}
	return &WeatherHandler{
		rdb: rdb,
		hc:  &http.Client{Timeout: 10 * time.Second, Transport: transport},
	}
}

func (h *WeatherHandler) GetWeather(c *gin.Context) {
	ctx := c.Request.Context()

	cacheKey := "weather:cities:v1"
	if cached, err := h.rdb.Get(ctx, cacheKey).Result(); err == nil {
		var resp weatherCitiesResponse
		if json.Unmarshal([]byte(cached), &resp) == nil {
			c.JSON(http.StatusOK, resp)
			return
		}
	}

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		results = make([]weatherResponse, 0, len(cities))
	)

	for _, city := range cities {
		wg.Add(1)
		go func(city struct {
			Name string
			Lat  float64
			Lon  float64
		}) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					slog.Error("weather goroutine panic", "city", city.Name, "panic", r)
				}
			}()
			wr := fetchCityWeather(ctx, h.hc, city.Name, city.Lat, city.Lon)
			mu.Lock()
			results = append(results, wr)
			mu.Unlock()
		}(city)
	}
	wg.Wait()

	resp := weatherCitiesResponse{Cities: results}

	payload, _ := json.Marshal(resp)
	h.rdb.Set(ctx, cacheKey, payload, 30*time.Minute)

	c.JSON(http.StatusOK, resp)
}

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
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return weatherResponse{City: name, Temp: 0, Icon: "🌡️", Label: "不可用"}
	}
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
