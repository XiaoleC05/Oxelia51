package proxykey

import "time"

// ProxyKey 代理网关项目密钥（proxy_keys 表）。
type ProxyKey struct {
	ID         int64     `json:"id"`
	ProjectID  string    `json:"projectId"`
	KeyPrefix  string    `json:"keyPrefix"`
	Enabled    bool      `json:"enabled"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
}
