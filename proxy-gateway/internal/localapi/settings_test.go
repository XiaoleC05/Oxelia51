package localapi

import (
	"database/sql"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

// TestDefaultPricingMatchesSeed 防漂移（#25）：桌面「一键填入」参考价（defaultPricing）
// 与云端成本基准（003_model_pricing_seed.sql）的共有模型价格必须一致，
// 否则用户换设备/对比云端成本时口径不同。
//
// 注意：seed 含而 defaultPricing 缺的模型（如 qwen-plus、kimi-k2）不在此校验——
// 桌面端参考价是「常见模型子集」，seed 是云端完整表。此测试只校验二者交集。
func TestDefaultPricingMatchesSeed(t *testing.T) {
	seedPath := filepath.Join("..", "..", "..", "analytics", "deploy", "migrations", "003_model_pricing_seed.sql")
	seedAbs, err := filepath.Abs(seedPath)
	if err != nil {
		t.Fatalf("resolve seed path: %v", err)
	}
	data, err := os.ReadFile(seedAbs)
	if err != nil {
		t.Fatalf("read seed file %s: %v", seedAbs, err)
	}

	// 解析 seed 里的 (model, provider, prompt, completion) 行
	re := regexp.MustCompile(`\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)`)
	seed := map[string]ModelPrice{}
	for _, m := range re.FindAllStringSubmatch(string(data), -1) {
		model := m[1]
		p, _ := strconv.ParseFloat(m[2], 64)
		c, _ := strconv.ParseFloat(m[3], 64)
		seed[model] = ModelPrice{Prompt: p, Completion: c}
	}
	if len(seed) < 10 {
		t.Fatalf("seed parse too few entries: %d (regex wrong?)", len(seed))
	}

	// 校验共有模型：价格必须一致
	// 注意：模型名是精确匹配，seed 的 claude-haiku-4-5 与 defaultPricing 的
	// claude-haiku-4.5 命名不同（历史遗留），不算共有模型，不在此校验。
	var mismatches []string
	for model, want := range seed {
		got, ok := defaultPricing[model]
		if !ok {
			continue // seed 有、defaultPricing 无 → 桌面不展示，跳过
		}
		if abs(got.Prompt-want.Prompt) > 0.005 || abs(got.Completion-want.Completion) > 0.005 {
			mismatches = append(mismatches,
				strings.TrimSpace(model)+": defaultPricing="+fmtPrice(got)+" seed="+fmtPrice(want))
		}
	}
	if len(mismatches) > 0 {
		t.Fatalf("defaultPricing 与 seed 共有模型价格不一致（%d 处）：\n%s\n修复：\n  - 若官方价变，先改 seed（003+004 migration），再同步 defaultPricing\n  - 或反之（以云端 seed 为基准）",
			len(mismatches), strings.Join(mismatches, "\n"))
	}
}

func fmtPrice(p ModelPrice) string {
	return "{" + strconv.FormatFloat(p.Prompt, 'f', 2, 64) + ", " +
		strconv.FormatFloat(p.Completion, 'f', 2, 64) + "}"
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}

// newTestAPI 用内存 SQLite 建一个 API 实例（含 settings 表）。
func newTestAPI(t *testing.T) *API {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err := db.Exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`); err != nil {
		t.Fatal(err)
	}
	return New(db)
}

// TestPricingMapCache 锁住 #26：缓存命中（TTL 内不重查）+ 保存后立即失效。
func TestPricingMapCache(t *testing.T) {
	a := newTestAPI(t)
	a.setSetting("pricing", `[{"model":"gpt-5","prompt":"1.25","completion":"10"}]`)

	first := a.getPricingMap()
	if v, ok := first["gpt-5"]; !ok || v.Prompt != 1.25 {
		t.Fatalf("first get: %v", first)
	}
	// 缓存对象应复用（未重查）
	second := a.getPricingMap()
	if &first == &second {
		t.Fatal("map pointer identical (unexpected)")
	}
	if first["gpt-5"] != second["gpt-5"] {
		t.Fatal("cached value changed unexpectedly")
	}
	// 保存定价后缓存应失效（新值立即可见）
	a.setSetting("pricing", `[{"model":"gpt-5","prompt":"2.50","completion":"20"}]`)
	afterSave := a.getPricingMap()
	if v, ok := afterSave["gpt-5"]; !ok || v.Prompt != 2.50 {
		t.Fatalf("after save: expected prompt 2.50, got %v", afterSave["gpt-5"])
	}
	// 空 pricing 也应缓存（清空后返回空表且缓存命中）
	a.setSetting("pricing", "")
	if m := a.getPricingMap(); len(m) != 0 {
		t.Fatalf("after clear: expected empty, got %v", m)
	}
}

// TestPricingMapCacheTTL 锁住 TTL 生效：改 DB 后 TTL 未到仍命中旧缓存。
func TestPricingMapCacheTTL(t *testing.T) {
	a := newTestAPI(t)
	a.setSetting("pricing", `[{"model":"gpt-5","prompt":"1.25","completion":"10"}]`)
	a.getPricingMap() // 填充缓存

	// 绕过 setSetting 直接改 DB（模拟外部写入，不触发失效）
	if _, err := a.db.Exec(`UPDATE settings SET value = $1 WHERE key = 'pricing'`,
		`[{"model":"gpt-5","prompt":"99","completion":"99"}]`); err != nil {
		t.Fatal(err)
	}

	// TTL 内应命中旧缓存
	if m := a.getPricingMap(); m["gpt-5"].Prompt != 1.25 {
		t.Fatalf("within TTL: expected cached 1.25, got %v", m["gpt-5"].Prompt)
	}

	// 推进时间到 TTL 后，应读到新值
	a.pricingCachedAt = time.Now().Add(-(pricingCacheTTL + time.Second))
	if m := a.getPricingMap(); m["gpt-5"].Prompt != 99 {
		t.Fatalf("after TTL: expected 99, got %v", m["gpt-5"].Prompt)
	}
}
