package admin

import (
	"context"
	"os"
	"strings"

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

// IsAllowed 检查 IP 是否在白名单中（#13：统一 fail-close）。
//
// 安全语义（针对 /api/admin/exec 任意命令执行接口）：
//   - 白名单为空 → 拒绝（管理员需先通过直连 DB 或 BREAK_GLASS_IP 添加首条）
//   - DB 故障     → 拒绝（原 fail-open 在 DB 抖动时对所有 admin JWT 开放 RCE）
//   - 命中        → 放行
//   - OXELIA_BREAK_GLASS_IP 环境变量指定的 IP 永远放行（紧急救援，不依赖 DB）
func (r *WhitelistRepository) IsAllowed(ctx context.Context, ip string) (bool, error) {
	if bg := strings.TrimSpace(os.Getenv("OXELIA_BREAK_GLASS_IP")); bg != "" && ip == bg {
		return true, nil
	}
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM ip_whitelist`).Scan(&count)
	if err != nil {
		// fail-close：DB 故障时拒绝，避免 RCE 接口在 DB 抖动期对所有人开放
		return false, err
	}
	// 白名单为空时，拒绝所有 IP（管理员需先通过 BREAK_GLASS_IP 或直连 DB 添加第一条）
	if count == 0 {
		return false, nil
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
