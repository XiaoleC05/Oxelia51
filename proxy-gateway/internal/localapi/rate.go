package localapi

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// USD→CNY 汇率（模型价格表的 CNY 计价用）。桌面离线优先，汇率每日从权威源
// 拉取一次并持久化到 settings；失败回退上次成功值，再回退固定参考值 7.2
// （与云端 oxelia51.exchange_rates 的口径一致，不做伪精确）。
const fallbackUsdCny = 7.2

// usdCnyRate 汇率响应体（GET /api/pricing/rate）。
type usdCnyRate struct {
	Rate      float64 `json:"usd_to_cny"`
	Source    string  `json:"source"`
	UpdatedAt string  `json:"updated_at"`
}

type rateCache struct {
	rate      float64
	source    string
	updatedAt string
}

// loadRateFromSettings 读取持久化的上次成功汇率（离线回退用）。
func (a *API) loadRateFromSettings() {
	raw := a.getSetting("usd_cny_rate")
	if raw == "" {
		return
	}
	var r usdCnyRate
	if json.Unmarshal([]byte(raw), &r) == nil && r.Rate > 0 {
		a.rateMu.Lock()
		a.rate = &rateCache{rate: r.Rate, source: r.Source, updatedAt: r.UpdatedAt}
		a.rateMu.Unlock()
	}
}

func (a *API) persistRate(r usdCnyRate) {
	b, _ := json.Marshal(r)
	// 后台任务无 HTTP 层可报错，持久化失败记日志（内存中汇率仍生效，下次拉取会重试写入）
	if err := a.setSetting("usd_cny_rate", string(b)); err != nil {
		log.Printf("settings usd_cny_rate persist failed: %v", err)
	}
}

// fetchRate 从权威源拉取当日 USD→CNY 汇率。
// 优先 Frankfurter（欧央行每日基准，权威）；失败退 open.er-api.com。
func fetchRate() (usdCnyRate, bool) {
	client := &http.Client{Timeout: 6 * time.Second}
	type src struct {
		url    string
		source string
		parse  func(map[string]any) (float64, bool)
	}
	try := []src{
		{
			url: "https://api.frankfurter.app/latest?from=USD&to=CNY", source: "Frankfurter（欧央行基准）",
			parse: func(m map[string]any) (float64, bool) {
				rates, ok := m["rates"].(map[string]any)
				if !ok {
					return 0, false
				}
				v, ok := rates["CNY"].(float64)
				return v, ok && v > 0
			},
		},
		{
			url: "https://open.er-api.com/v6/latest/USD", source: "Open Exchange Rates",
			parse: func(m map[string]any) (float64, bool) {
				rates, ok := m["rates"].(map[string]any)
				if !ok {
					return 0, false
				}
				v, ok := rates["CNY"].(float64)
				return v, ok && v > 0
			},
		},
	}
	for _, t := range try {
		resp, err := client.Get(t.url)
		if err != nil {
			continue
		}
		var m map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()
		if v, ok := t.parse(m); ok {
			return usdCnyRate{Rate: v, Source: t.source, UpdatedAt: time.Now().Format("2006-01-02")}, true
		}
	}
	return usdCnyRate{}, false
}

// ensureRateLoop 启动时立即拉一次（失败按 15s/30s/60s 退避重试，共 4 次，
// 覆盖网络抖动 / 慢启动），之后每 24h 拉一次（后台 goroutine）。
func (a *API) ensureRateLoop() {
	apply := func(r usdCnyRate) {
		a.persistRate(r)
		a.rateMu.Lock()
		a.rate = &rateCache{rate: r.Rate, source: r.Source, updatedAt: r.UpdatedAt}
		a.rateMu.Unlock()
	}
	go func() {
		for attempt := 0; attempt < 4; attempt++ {
			if r, ok := fetchRate(); ok {
				apply(r)
				break
			}
			time.Sleep(time.Duration(15*(attempt+1)) * time.Second)
		}
		t := time.NewTicker(24 * time.Hour)
		defer t.Stop()
		for range t.C {
			if r, ok := fetchRate(); ok {
				apply(r)
			}
		}
	}()
}

// getUsdCnyRate 返回当前汇率（含来源与更新时间）。无缓存时用内置参考值。
func (a *API) getUsdCnyRate() usdCnyRate {
	a.rateMu.Lock()
	defer a.rateMu.Unlock()
	if a.rate != nil {
		return usdCnyRate{Rate: a.rate.rate, Source: a.rate.source, UpdatedAt: a.rate.updatedAt}
	}
	return usdCnyRate{Rate: fallbackUsdCny, Source: "内置参考值", UpdatedAt: ""}
}

// handlePricingRate GET /api/pricing/rate：返回当前 USD→CNY 汇率。
func (a *API) handlePricingRate(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, a.getUsdCnyRate())
}
