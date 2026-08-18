package recorder

import (
	"crypto/sha256"
	"encoding/hex"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
)

// resolveAPIKeyHash 返回一条记录落库用的 API key hash。
// 优先用记录自带的 APIKeyHash；为空时回退 sha256(projectID) 的 hex。
// 统一截断到 64 字节，对齐 ClickHouse api_key_hash FixedString(64) 列宽。
func resolveAPIKeyHash(r adapter.TokenRecord) string {
	h := r.APIKeyHash
	if h == "" {
		sum := sha256.Sum256([]byte(r.ProjectID))
		h = hex.EncodeToString(sum[:])
	}
	if len(h) > 64 {
		h = h[:64]
	}
	return h
}
