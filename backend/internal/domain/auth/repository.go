package auth

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type RefreshStore struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewRefreshStore(rdb *redis.Client, ttl time.Duration) *RefreshStore {
	return &RefreshStore{rdb: rdb, ttl: ttl}
}

func (s *RefreshStore) key(token string) string {
	return "refresh:" + token
}

func (s *RefreshStore) Set(ctx context.Context, token, userID string) error {
	return s.rdb.Set(ctx, s.key(token), userID, s.ttl).Err()
}

func (s *RefreshStore) Get(ctx context.Context, token string) (string, error) {
	return s.rdb.Get(ctx, s.key(token)).Result()
}

func (s *RefreshStore) Delete(ctx context.Context, token string) error {
	return s.rdb.Del(ctx, s.key(token)).Err()
}

type JWTBlacklist struct {
	rdb *redis.Client
}

func NewJWTBlacklist(rdb *redis.Client) *JWTBlacklist {
	return &JWTBlacklist{rdb: rdb}
}

func (b *JWTBlacklist) key(jti string) string {
	return "jwt:blacklist:" + jti
}

func (b *JWTBlacklist) Add(ctx context.Context, jti string, ttl time.Duration) error {
	return b.rdb.Set(ctx, b.key(jti), "1", ttl).Err()
}

func (b *JWTBlacklist) Has(ctx context.Context, jti string) (bool, error) {
	n, err := b.rdb.Exists(ctx, b.key(jti)).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}
