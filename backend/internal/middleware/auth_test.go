package middleware

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestClaimBool(t *testing.T) {
	cases := []struct {
		name   string
		claims jwt.MapClaims
		key    string
		want   bool
	}{
		{"bool true", jwt.MapClaims{"email_verified": true}, "email_verified", true},
		{"bool false", jwt.MapClaims{"email_verified": false}, "email_verified", false},
		{"string true", jwt.MapClaims{"email_verified": "true"}, "email_verified", true},
		{"string false", jwt.MapClaims{"email_verified": "false"}, "email_verified", false},
		{"missing key", jwt.MapClaims{}, "email_verified", false},
		{"nil value", jwt.MapClaims{"email_verified": nil}, "email_verified", false},
		{"int 1 (unexpected type)", jwt.MapClaims{"email_verified": 1}, "email_verified", false},
		{"unrelated key", jwt.MapClaims{"other": true}, "email_verified", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := claimBool(tc.claims, tc.key)
			if got != tc.want {
				t.Errorf("claimBool(%+v, %q) = %v, want %v", tc.claims, tc.key, got, tc.want)
			}
		})
	}
}
