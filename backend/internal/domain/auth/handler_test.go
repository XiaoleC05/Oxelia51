package auth

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

// TestDummyBcryptHash 锁住防登录时序枚举的占位 hash：
// 必须是合法 bcrypt、与任意密码比对失败、且成本与真实密码哈希一致（DefaultCost），
// 否则「账户不存在」分支的占位比对拉不平真实比对的耗时（见 Login）。
func TestDummyBcryptHash(t *testing.T) {
	if err := bcrypt.CompareHashAndPassword(dummyBcryptHash, []byte("any-password")); err == nil {
		t.Fatal("dummy hash 不应匹配任何密码")
	}
	cost, err := bcrypt.Cost(dummyBcryptHash)
	if err != nil {
		t.Fatalf("dummy hash 不是合法 bcrypt: %v", err)
	}
	if cost != bcrypt.DefaultCost {
		t.Fatalf("dummy hash cost = %d, want DefaultCost(%d)", cost, bcrypt.DefaultCost)
	}
}
