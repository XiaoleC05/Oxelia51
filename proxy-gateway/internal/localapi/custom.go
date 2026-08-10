package localapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// 自定义供应商（用户自填 slug / baseUrl / 协议，预设路由之外的上游）。
// 存本地 SQLite settings 表 key=custom_providers（JSON 数组），仅经本文件的校验端点写入
// （故意不进 allowedSettingKeys 白名单）；云端部署的网关读服务器本地库，仅 127.0.0.1 可写。

// customProvidersKey settings 表存储 key。
const customProvidersKey = "custom_providers"

// customCacheTTL 自定义供应商缓存有效期（Match 热路径不每请求查 SQL；
// 经端点/setSetting 写入时主动失效，见 setSetting）。
const customCacheTTL = 5 * time.Second

// getCustomProviders 返回当前自定义供应商列表（带短 TTL 缓存；调用方只读）。
func (a *API) getCustomProviders() []adapter.CustomProvider {
	a.cmu.Lock()
	defer a.cmu.Unlock()

	if a.customCached != nil && time.Since(a.customCachedAt) < customCacheTTL {
		return a.customCached
	}

	items := []adapter.CustomProvider{}
	raw := a.getSetting(customProvidersKey)
	if raw != "" {
		if err := json.Unmarshal([]byte(raw), &items); err != nil {
			log.Printf("settings custom_providers parse failed: %v", err)
			items = []adapter.CustomProvider{}
		}
	}
	a.customCached = items
	a.customCachedAt = time.Now()
	return items
}

// invalidateCustomProviders 主动失效缓存（写入后 Match 立即可见）。
func (a *API) invalidateCustomProviders() {
	a.cmu.Lock()
	a.customCached = nil
	a.cmu.Unlock()
}

// CustomSource 供 adapter.Registry.SetCustomSource 挂接（Match 静态表查无后回退）。
func (a *API) CustomSource() adapter.CustomSource {
	return a.getCustomProviders
}

// upsertCustomProvider 校验并写入（同 slug 已存在视为更新）。ErrSlugConflict → 409。
func (a *API) upsertCustomProvider(p adapter.CustomProvider) error {
	if err := adapter.ValidateCustomProvider(p); err != nil {
		return err
	}
	// 直读 DB（不走缓存），避免 TTL 内并发写丢条目
	items := []adapter.CustomProvider{}
	if raw := a.getSetting(customProvidersKey); raw != "" {
		_ = json.Unmarshal([]byte(raw), &items)
	}
	found := false
	for i, it := range items {
		if it.Slug == p.Slug {
			items[i] = p
			found = true
			break
		}
	}
	if !found {
		items = append(items, p)
	}
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}
	a.setSetting(customProvidersKey, string(data)) // setSetting 内主动失效缓存
	return nil
}

// deleteCustomProvider 删除自定义供应商；内置 slug 拒绝（只能删自定义）。
func (a *API) deleteCustomProvider(slug string) error {
	if adapter.IsBuiltinSlug(slug) {
		return errors.New("cannot delete builtin provider")
	}
	items := []adapter.CustomProvider{}
	if raw := a.getSetting(customProvidersKey); raw != "" {
		_ = json.Unmarshal([]byte(raw), &items)
	}
	out := items[:0]
	for _, it := range items {
		if it.Slug != slug {
			out = append(out, it)
		}
	}
	data, err := json.Marshal(out)
	if err != nil {
		return err
	}
	a.setSetting(customProvidersKey, string(data))
	return nil
}

// handleCustomProviders GET 列表 / POST 新增或更新（upsert）。
// 合约：GET → {"items":[{slug,name,baseUrl,protocol}]}；
// POST body {slug,name,baseUrl,protocol} → {"ok":true}；校验失败 400 {"error"}、slug 冲突 409 {"error"}。
func (a *API) handleCustomProviders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"items": a.getCustomProviders()})
	case http.MethodPost:
		var p adapter.CustomProvider
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
			return
		}
		if err := a.upsertCustomProvider(p); err != nil {
			if errors.Is(err, adapter.ErrSlugConflict) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// handleCustomProvidersDelete POST body {slug} → {"ok":true}；内置 slug 拒绝（400）。
func (a *API) handleCustomProvidersDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Slug string `json:"slug"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Slug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.deleteCustomProvider(req.Slug); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
