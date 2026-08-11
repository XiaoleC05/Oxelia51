package adapter

import (
	"strings"
	"testing"
)

// TestValidateCustomProvider_PrivateHostBlocked 锁住自定义供应商的内网阻断：
// 写入时解析 host，解析到私有/环回/链路本地地址（https）一律拒绝（SSRF 面）。
// 全部用 IP 字面量 / 必失败的 .invalid 域名，不依赖外网 DNS。
func TestValidateCustomProvider_PrivateHostBlocked(t *testing.T) {
	base := CustomProvider{Slug: "corp-x", Name: "测试", Protocol: "openai"}

	reject := []string{
		"https://10.0.0.1",               // 私网 A 段
		"https://172.16.0.1",             // 私网 B 段
		"https://192.168.1.1",            // 私网 C 段
		"https://127.0.0.1:8443",         // 环回
		"https://[::1]",                  // IPv6 环回
		"https://169.254.169.254/latest", // 链路本地（云元数据端点）
		"https://[fe80::1]",              // IPv6 链路本地
	}
	for _, u := range reject {
		p := base
		p.BaseURL = u
		if err := ValidateCustomProvider(p); err == nil {
			t.Errorf("baseUrl %q: expected reject, got nil", u)
		} else if !strings.Contains(err.Error(), "private") {
			t.Errorf("baseUrl %q: unexpected error: %v", u, err)
		}
	}

	allow := []string{
		"https://8.8.8.8",                // 公网 IP 字面量
		"http://127.0.0.1:11434/v1",      // http 回环是本机自托管例外
		"https://nonexistent.invalid/v1", // 解析失败放行（写入时校验的既定取舍）
	}
	for _, u := range allow {
		p := base
		p.BaseURL = u
		if err := ValidateCustomProvider(p); err != nil {
			t.Errorf("baseUrl %q: expected allow, got %v", u, err)
		}
	}
}
