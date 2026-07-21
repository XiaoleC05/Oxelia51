package admin

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WhitelistRepository struct {
	db *pgxpool.Pool
}

func NewWhitelistRepository(db *pgxpool.Pool) *WhitelistRepository {
	return &WhitelistRepository{db: db}
}

// List 返回所有白名单条目
func (r *WhitelistRepository) List(ctx context.Context) ([]IPWhitelist, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, ip, label, created_at FROM ip_whitelist ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []IPWhitelist{}
	for rows.Next() {
		var item IPWhitelist
		if err := rows.Scan(&item.ID, &item.IP, &item.Label, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// Create 新增一条白名单
func (r *WhitelistRepository) Create(ctx context.Context, ip, label string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO ip_whitelist (ip, label) VALUES ($1, $2) ON CONFLICT (ip) DO NOTHING`,
		ip, label)
	return err
}

// Delete 删除一条白名单
func (r *WhitelistRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.Exec(ctx, `DELETE FROM ip_whitelist WHERE id = $1`, id)
	return err
}

// Update 更新白名单条目的标签
func (r *WhitelistRepository) Update(ctx context.Context, id int, ip, label string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE ip_whitelist SET ip = $1, label = $2 WHERE id = $3`,
		ip, label, id)
	return err
}

// IsAllowed 检查 IP 是否在白名单中。白名单为空时放行所有。
func (r *WhitelistRepository) IsAllowed(ctx context.Context, ip string) (bool, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM ip_whitelist`).Scan(&count)
	if err != nil {
		return false, err
	}
	// 白名单为空时，允许所有 IP（防止管理员锁死自己）
	if count == 0 {
		return true, nil
	}

	var exists int
	err = r.db.QueryRow(ctx,
		`SELECT 1 FROM ip_whitelist WHERE ip = $1`, ip).Scan(&exists)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
