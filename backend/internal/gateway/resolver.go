package gateway

import (
	"os"
	"strings"
)

// ResolveInternalAPIBase 解析上游地址：环境变量覆盖 > DB 字段
func ResolveInternalAPIBase(slug, dbBase string) string {
	key := "TOOL_API_BASE_" + strings.ToUpper(strings.ReplaceAll(slug, "-", "_"))
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return strings.TrimRight(v, "/")
	}
	return strings.TrimRight(strings.TrimSpace(dbBase), "/")
}
