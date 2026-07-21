package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

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

// PendingRegistrationStore holds registration data until email is verified.
type PendingRegistrationStore struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewPendingRegistrationStore(rdb *redis.Client, ttl time.Duration) *PendingRegistrationStore {
	return &PendingRegistrationStore{rdb: rdb, ttl: ttl}
}

func (s *PendingRegistrationStore) Set(ctx context.Context, token string, data []byte) error {
	return s.rdb.Set(ctx, "pending_reg:"+token, data, s.ttl).Err()
}

func (s *PendingRegistrationStore) Get(ctx context.Context, token string) ([]byte, error) {
	return s.rdb.Get(ctx, "pending_reg:"+token).Bytes()
}

func (s *PendingRegistrationStore) Delete(ctx context.Context, token string) error {
	return s.rdb.Del(ctx, "pending_reg:"+token).Err()
}

// ScanKeys 扫描所有 pending_reg:* 键（最多 limit 个，使用 SCAN 替代 KEYS 避免阻塞）
func (s *PendingRegistrationStore) ScanKeys(ctx context.Context, limit int) ([]string, error) {
	var keys []string
	var cursor uint64
	for {
		var batch []string
		var err error
		batch, cursor, err = s.rdb.Scan(ctx, cursor, "pending_reg:*", int64(limit)).Result()
		if err != nil {
			return nil, fmt.Errorf("scan pending registrations: %w", err)
		}
		keys = append(keys, batch...)
		if cursor == 0 || len(keys) >= limit {
			break
		}
	}
	return keys, nil
}

// GetByKey 按完整 Redis 键获取待注册数据
func (s *PendingRegistrationStore) GetByKey(ctx context.Context, key string) ([]byte, error) {
	return s.rdb.Get(ctx, key).Bytes()
}
