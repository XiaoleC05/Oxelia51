package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	rdb *redis.Client
}

func NewRateLimiter(rdb *redis.Client) *RateLimiter {
	return &RateLimiter{rdb: rdb}
}

func (l *RateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	pipe := l.rdb.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}
	count, err := incr.Result()
	if err != nil {
		return false, err
	}
	return count <= int64(limit), nil
}

func (l *RateLimiter) Count(ctx context.Context, key string) (int64, error) {
	n, err := l.rdb.Get(ctx, key).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return n, err
}

type EmailTokenStore struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewEmailTokenStore(rdb *redis.Client, ttl time.Duration) *EmailTokenStore {
	return &EmailTokenStore{rdb: rdb, ttl: ttl}
}

func (s *EmailTokenStore) key(tokenType, token string) string {
	return fmt.Sprintf("email_token:%s:%s", tokenType, token)
}

func (s *EmailTokenStore) Set(ctx context.Context, tokenType, token, userID string) error {
	return s.rdb.Set(ctx, s.key(tokenType, token), userID, s.ttl).Err()
}

func (s *EmailTokenStore) Get(ctx context.Context, tokenType, token string) (string, error) {
	return s.rdb.Get(ctx, s.key(tokenType, token)).Result()
}

func (s *EmailTokenStore) Delete(ctx context.Context, tokenType, token string) error {
	return s.rdb.Del(ctx, s.key(tokenType, token)).Err()
}

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
