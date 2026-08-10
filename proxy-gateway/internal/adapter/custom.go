package adapter

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"
)

// CustomProvider 用户自定义供应商（预设路由之外的自填上游）。
// 存本地 SQLite settings 表（key=custom_providers，JSON 数组），
// 由 localapi 的校验端点写入；云端部署的网关读服务器本地库，仅 127.0.0.1 可写。
type CustomProvider struct {
	Slug     string `json:"slug"`     // 代理路径：/api/proxy/<slug>/
	Name     string `json:"name"`     // 展示名（1-50 字）
	BaseURL  string `json:"baseUrl"`  // scheme://host[:port][/base-path]
	Protocol string `json:"protocol"` // openai | anthropic
}

// ErrSlugConflict slug 与内置 providerSpecs 冲突（HTTP 409）。
var ErrSlugConflict = errors.New("slug conflicts with builtin provider")

var customSlugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,30}$`)

// IsBuiltinSlug 判断 slug 是否为内置供应商（自定义供应商不得占用）。
func IsBuiltinSlug(slug string) bool {
	for _, p := range providerSpecs {
		if p.slug == slug {
			return true
		}
	}
	return false
}

// ValidateCustomProvider 写入前严格校验；返回 ErrSlugConflict 表示与内置冲突。
func ValidateCustomProvider(p CustomProvider) error {
	if !customSlugRe.MatchString(p.Slug) {
		return fmt.Errorf("invalid slug %q: must match %s", p.Slug, customSlugRe)
	}
	if IsBuiltinSlug(p.Slug) {
		return ErrSlugConflict
	}
	if n := utf8.RuneCountInString(strings.TrimSpace(p.Name)); n < 1 || n > 50 {
		return fmt.Errorf("invalid name: length must be 1-50 chars, got %d", n)
	}
	if p.Protocol != "openai" && p.Protocol != "anthropic" {
		return fmt.Errorf("invalid protocol %q: must be openai or anthropic", p.Protocol)
	}
	_, _, _, err := ParseCustomBaseURL(p.BaseURL)
	return err
}

// ParseCustomBaseURL 解析自定义供应商 baseUrl 为 (scheme, host, pathPrefix)。
// 规则：必须 https（仅 http://127.0.0.1 / http://localhost 例外，供本机自托管）；
// 拒绝 userinfo（防 key 泄漏进 URL）、query、fragment；base-path 不得以 / 结尾。
func ParseCustomBaseURL(raw string) (scheme, host, pathPrefix string, err error) {
	u, perr := url.Parse(strings.TrimSpace(raw))
	if perr != nil || u.Host == "" {
		return "", "", "", fmt.Errorf("invalid baseUrl %q", raw)
	}
	if u.User != nil {
		return "", "", "", fmt.Errorf("invalid baseUrl: userinfo not allowed")
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return "", "", "", fmt.Errorf("invalid baseUrl: query/fragment not allowed")
	}
	scheme = strings.ToLower(u.Scheme)
	if scheme == "http" {
		if h := strings.ToLower(u.Hostname()); h != "127.0.0.1" && h != "localhost" {
			return "", "", "", fmt.Errorf("invalid baseUrl: plain http only allowed for 127.0.0.1/localhost")
		}
	} else if scheme != "https" {
		return "", "", "", fmt.Errorf("invalid baseUrl: scheme must be https")
	}
	pathPrefix = u.Path
	if pathPrefix == "/" {
		pathPrefix = ""
	} else if strings.HasSuffix(pathPrefix, "/") || strings.Contains(pathPrefix, "//") {
		return "", "", "", fmt.Errorf("invalid baseUrl: malformed path (trailing/double slash)")
	}
	return scheme, u.Host, pathPrefix, nil
}

// route 把自定义供应商转为代理 Route（校验须已通过 ValidateCustomProvider）。
// 落账 provider 名用 slug（与内置一致，token_events.provider 按它聚合）。
func (p CustomProvider) route() (Route, string, error) {
	scheme, host, pathPrefix, err := ParseCustomBaseURL(p.BaseURL)
	if err != nil {
		return Route{}, "", err
	}
	var ad Adapter
	anthropic := p.Protocol == "anthropic"
	if anthropic {
		ad = NewAnthropicAdapter(p.Slug)
	} else {
		ad = NewOpenAIAdapter(p.Slug)
	}
	return Route{
		Adapter:     ad,
		Target:      host,
		PathPrefix:  pathPrefix,
		Scheme:      scheme,
		Custom:      true,
		XAPIKeyAuth: anthropic, // Anthropic 协议用 x-api-key 上行
	}, "/api/proxy/" + p.Slug + "/", nil
}
