// Package version 持有代理网关的构建版本号。
// 默认 "dev"（本地 go run / 未注入 ldflags 的构建）；正式发布由 CI 经
// -ldflags "-X github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/version.V=<tag>"
// 注入（如 v0.1.8 → "0.1.8"）。桌面端用它判断「运行中代理 vs 打包代理」版本差，
// 决定独立后台代理是否需要重启换新。
package version

// V 构建版本（发布 tag 去 v 前缀，如 "0.1.8"）。
var V = "dev"
