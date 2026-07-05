package auth

import (
	"testing"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/model"
)

func TestIssueAccess_IncludesEmailVerified(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:     "test-secret-key",
		AccessTokenTTL: time.Hour,
	}
	svc := NewTokenService(cfg)

	t.Run("verified user has email_verified=true", func(t *testing.T) {
		user := model.User{
			ID:            1,
			Username:      "alice",
			Role:          "user",
			EmailVerified: true,
		}
		token, _, _, err := svc.IssueAccess(user)
		if err != nil {
			t.Fatal(err)
		}
		claims, err := svc.ParseAccess(token)
		if err != nil {
			t.Fatal(err)
		}
		v, ok := claims["email_verified"]
		if !ok {
			t.Fatal("email_verified claim missing")
		}
		verified, ok := v.(bool)
		if !ok {
			t.Fatalf("email_verified claim type = %T, want bool", v)
		}
		if !verified {
			t.Error("email_verified = false, want true")
		}
	})

	t.Run("unverified user has email_verified=false", func(t *testing.T) {
		user := model.User{
			ID:            2,
			Username:      "bob",
			Role:          "user",
			EmailVerified: false,
		}
		token, _, _, err := svc.IssueAccess(user)
		if err != nil {
			t.Fatal(err)
		}
		claims, err := svc.ParseAccess(token)
		if err != nil {
			t.Fatal(err)
		}
		v, ok := claims["email_verified"]
		if !ok {
			t.Fatal("email_verified claim missing")
		}
		verified, ok := v.(bool)
		if !ok {
			t.Fatalf("email_verified claim type = %T, want bool", v)
		}
		if verified {
			t.Error("email_verified = true, want false")
		}
	})
}
