package admin

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"golang.org/x/crypto/bcrypt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const adminUsername = "oxelia51"

// EnsureAdmin creates the sole admin user if missing (ADMIN-01).
func EnsureAdmin(ctx context.Context, pool *pgxpool.Pool, cfg *config.Config) error {
	var exists bool
	err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, adminUsername).Scan(&exists)
	if err != nil {
		return fmt.Errorf("检查管理员账号失败: %w", err)
	}
	if exists {
		return nil
	}

	password := cfg.AdminInitialPassword
	generated := false
	if password == "" {
		var genErr error
		password, genErr = generatePassword(24)
		if genErr != nil {
			return genErr
		}
		generated = true
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("管理员密码哈希失败: %w", err)
	}

	email := "admin@oxelia51.local"
	_, err = pool.Exec(ctx,
		`INSERT INTO users (username, password, email, role, email_verified)
		 VALUES ($1, $2, $3, 'admin', TRUE)`,
		adminUsername, string(hash), email,
	)
	if err != nil {
		return fmt.Errorf("创建管理员失败: %w", err)
	}

	log.Printf("管理员账号已创建: username=%s email=%s", adminUsername, email)

	if generated {
		log.Printf("[一次性] 管理员初始密码已生成，请查看桌面文件 oxelia51-admin-password.txt")
		if err := writeDesktopPassword(password); err != nil {
			log.Printf("警告: 无法写入桌面密码文件: %v", err)
			log.Printf("[一次性] 管理员初始密码: %s", password)
		}
	} else {
		log.Printf("管理员使用 ADMIN_INITIAL_PASSWORD 环境变量创建")
	}

	return nil
}

func generatePassword(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("生成随机密码失败: %w", err)
	}
	// URL-safe base64, trim to requested length
	s := base64.RawURLEncoding.EncodeToString(b)
	if len(s) > length {
		s = s[:length]
	}
	return s, nil
}

func writeDesktopPassword(password string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	path := filepath.Join(home, "Desktop", "oxelia51-admin-password.txt")
	content := fmt.Sprintf(`Oxelia51 管理员初始密码（仅首次生成）
生成时间: %s
用户名: %s
密码: %s

请立即移至密码管理器并删除本文件。
`, time.Now().Format(time.RFC3339), adminUsername, password)

	return os.WriteFile(path, []byte(content), 0600)
}
