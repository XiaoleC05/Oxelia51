package proxykey

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository proxy_keys 表读写。
type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Create 写入密钥（明文 key 已哈希）。
func (r *Repository) Create(ctx context.Context, projectID, keyHash, keyPrefix string) (*ProxyKey, error) {
	var k ProxyKey
	err := r.pool.QueryRow(ctx,
		`INSERT INTO proxy_keys (project_id, key_hash, key_prefix)
		 VALUES ($1, $2, $3)
		 RETURNING id, project_id, key_prefix, enabled, created_at, last_used_at`,
		projectID, keyHash, keyPrefix,
	).Scan(&k.ID, &k.ProjectID, &k.KeyPrefix, &k.Enabled, &k.CreatedAt, &k.LastUsedAt)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// List 某项目的所有密钥（含已禁用的，便于管理）。
func (r *Repository) List(ctx context.Context, projectID string) ([]ProxyKey, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, project_id, key_prefix, enabled, created_at, last_used_at
		 FROM proxy_keys WHERE project_id = $1
		 ORDER BY created_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProxyKey
	for rows.Next() {
		var k ProxyKey
		if err := rows.Scan(&k.ID, &k.ProjectID, &k.KeyPrefix, &k.Enabled, &k.CreatedAt, &k.LastUsedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// Disable 软删除（enabled=false）。返回受影响行数。
func (r *Repository) Disable(ctx context.Context, id int64) (int64, error) {
	tag, err := r.pool.Exec(ctx,
		`UPDATE proxy_keys SET enabled = false WHERE id = $1 AND enabled = true`, id)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// TouchLastUsed 记录最近使用时间（网关鉴权命中时更新）。
func (r *Repository) TouchLastUsed(ctx context.Context, id int64) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, _ = r.pool.Exec(ctx, `UPDATE proxy_keys SET last_used_at = now() WHERE id = $1`, id)
}

var _ = pgx.ErrNoRows // 保持 pgx 导入（类型断言等）
