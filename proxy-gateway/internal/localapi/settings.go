package localapi

import (
	"encoding/json"
	"log"
	"sort"
	"strconv"
	"strings"
)

// ModelPrice 单模型定价（USD / 每 1M tokens）。
type ModelPrice struct {
	Prompt     float64 `json:"prompt"`
	Completion float64 `json:"completion"`
}

// 默认定价表（USD/1M tokens，近似公开价，可在设置页修改）。
// 缺失模型按 0 成本计，不虚构。
var defaultPricing = map[string]ModelPrice{
	"claude-sonnet-5":        {Prompt: 3.0, Completion: 15.0},
	"claude-sonnet-4":        {Prompt: 3.0, Completion: 15.0},
	"claude-opus-5":          {Prompt: 15.0, Completion: 75.0},
	"claude-haiku-4.5":       {Prompt: 1.0, Completion: 5.0},
	"gpt-5":                  {Prompt: 1.25, Completion: 10.0},
	"gpt-4o":                 {Prompt: 2.5, Completion: 10.0},
	"gpt-4.1":                {Prompt: 2.0, Completion: 8.0},
	"deepseek-chat":          {Prompt: 0.27, Completion: 1.1},
	"deepseek-reasoner":      {Prompt: 0.55, Completion: 2.19},
	"moonshot-v1-8k":         {Prompt: 12.0, Completion: 12.0},
	"glm-4":                  {Prompt: 0.1, Completion: 0.1},
	"qwen-max":               {Prompt: 20.0, Completion: 20.0},
	"doubao-pro-32k":         {Prompt: 0.8, Completion: 2.0},
	"gemini-2.5-pro":         {Prompt: 1.25, Completion: 10.0},
	"mistral-large":          {Prompt: 2.0, Completion: 6.0},
	"o1":                     {Prompt: 15.0, Completion: 60.0},
	"o3":                     {Prompt: 2.0, Completion: 8.0},
}

// Settings 本地设置（存 settings 表，key→value JSON）。
type Settings struct {
	Port     int          `json:"port"`
	Theme    string       `json:"theme"`
	Pricing  []PricedItem `json:"pricing"`
	Budgets  []BudgetItem `json:"budgets"`
	Sync     SyncConfig   `json:"sync"`
}

// PricedItem 定价表中的一行（前端可编辑）。
type PricedItem struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt"`     // 前端展示用字符串
	Completion string `json:"completion"`
}

// BudgetItem 预算阈值（model="*" 表示全局）。
type BudgetItem struct {
	Model       string `json:"model"`
	DailyTokens int64  `json:"dailyTokens"`
}

// SyncConfig 多设备同步配置（P4）。
type SyncConfig struct {
	Enabled   bool   `json:"enabled"`
	Account   string `json:"account"`
	LastSync  string `json:"lastSync"`
}

func (a *API) getSetting(key string) string {
	var v string
	err := a.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&v)
	if err != nil {
		return ""
	}
	return v
}

func (a *API) setSetting(key, value string) {
	_, _ = a.db.Exec(
		"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		key, value,
	)
}

// getPricingMap 返回 model → ModelPrice 的定价映射（仅用户已保存的定价）。
// 全新安装为空表（UI Polish v1：不虚构模型名/价目）；未配置的模型成本按 0 计。
func (a *API) getPricingMap() map[string]ModelPrice {
	m := make(map[string]ModelPrice)
	raw := a.getSetting("pricing")
	if raw == "" {
		return m
	}
	var items []PricedItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		log.Printf("settings pricing parse failed: %v", err)
		return m
	}
	for _, it := range items {
		p, c := parseFloat(it.Prompt), parseFloat(it.Completion)
		if p >= 0 && c >= 0 {
			m[it.Model] = ModelPrice{Prompt: p, Completion: c}
		}
	}
	return m
}

// defaultPricingList 返回内置常见模型参考价（供设置页「一键填入」；默认不展示、不参与成本）。
func (a *API) defaultPricingList() []PricedItem {
	models := make([]string, 0, len(defaultPricing))
	for m := range defaultPricing {
		models = append(models, m)
	}
	sort.Strings(models)
	items := make([]PricedItem, 0, len(models))
	for _, m := range models {
		p := defaultPricing[m]
		items = append(items, PricedItem{Model: m, Prompt: f2s(p.Prompt), Completion: f2s(p.Completion)})
	}
	return items
}

func parseFloat(s string) float64 {
	if s == "" {
		return -1
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return -1
	}
	return f
}

// costOf 计算一条记录的 USD 成本。
func costOf(pricing map[string]ModelPrice, model string, prompt, completion int64) float64 {
	p, ok := pricing[model]
	if !ok {
		return 0
	}
	return float64(prompt)/1e6*p.Prompt + float64(completion)/1e6*p.Completion
}

// getBudgets 返回预算列表（settings.budgets）。
func (a *API) getBudgets() []BudgetItem {
	raw := a.getSetting("budgets")
	if raw == "" {
		return nil
	}
	var items []BudgetItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		log.Printf("settings budgets parse failed: %v", err)
		return nil
	}
	return items
}

// loadSettings 读取全部设置（端口/主题/定价/预算/同步）。
func (a *API) loadSettings() Settings {
	port := 17800
	if p := a.getSetting("port"); p != "" {
		if v, err := strconv.Atoi(strings.TrimSpace(p)); err == nil && v > 0 {
			port = v
		}
	}
	theme := a.getSetting("theme")
	if theme == "" {
		theme = "cosmos"
	}
	var items []PricedItem
	raw := a.getSetting("pricing")
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &items)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Model < items[j].Model })
	sync := SyncConfig{Enabled: a.getSetting("sync_enabled") == "true", Account: a.getSetting("sync_account"), LastSync: a.getSetting("sync_last")}
	return Settings{Port: port, Theme: theme, Pricing: items, Budgets: a.getBudgets(), Sync: sync}
}
