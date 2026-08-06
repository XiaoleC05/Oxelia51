package proxy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// KeyStore 代理项目密钥解析：查阿里云 PG 的 proxy_keys 表，
// 将明文 key 做 sha256 哈希后匹配，返回归属 project_id。
type KeyStore struct {
	pool *pgxpool.Pool
}

// NewKeyStore 建立 PG 连接池并 Ping 验证。
func NewKeyStore(ctx context.Context, dsn string) (*KeyStore, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}
	return &KeyStore{pool: pool}, nil
}

func (s *KeyStore) Close() {
	if s != nil && s.pool != nil {
		s.pool.Close()
	}
}

func hashKey(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// Resolve 根据明文 key 解析归属项目。返回 (projectID, enabled, ok)；
// ok=false 表示 key 不存在或查询失败。
func (s *KeyStore) Resolve(ctx context.Context, rawKey string) (projectID string, enabled bool, ok bool) {
	if rawKey == "" || s == nil || s.pool == nil {
		return "", false, false
	}
	row := s.pool.QueryRow(ctx,
		"SELECT project_id, enabled FROM proxy_keys WHERE key_hash = $1 LIMIT 1",
		hashKey(rawKey))
	err := row.Scan(&projectID, &enabled)
	if err != nil {
		return "", false, false
	}
	return projectID, enabled, true
}
