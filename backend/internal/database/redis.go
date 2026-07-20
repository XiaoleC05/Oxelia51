package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

func ConnectRedis(ctx context.Context, addr string) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		DialTimeout:  5 * time.Second,
	})
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("Redis 连通性检查失败: %w", err)
	}
	slog.Info("redis connected")
	return client, nil
}
