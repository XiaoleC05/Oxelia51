package gateway

import "testing"

func TestCheckAccess(t *testing.T) {
	cases := []struct {
		name           string
		role           string
		userAccessible bool
		onlineCapable  bool
		status         string
		wantCode       string
		wantOK         bool
	}{
		{"admin enabled closed", "admin", false, true, "enabled", "", true},
		{"admin disabled", "admin", true, true, "disabled", "TOOL_OFFLINE", false},
		{"admin not online", "admin", true, false, "enabled", "TOOL_NOT_ONLINE", false},
		{"user open", "user", true, true, "enabled", "", true},
		{"user closed", "user", false, true, "enabled", "TOOL_NOT_ACCESSIBLE", false},
		{"user offline", "user", true, true, "disabled", "TOOL_OFFLINE", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := CheckAccess(tc.role, tc.userAccessible, tc.onlineCapable, tc.status)
			if tc.wantOK {
				if err != nil {
					t.Fatalf("expected ok, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatal("expected error")
			}
			ae, ok := err.(*AccessError)
			if !ok {
				t.Fatalf("expected AccessError, got %T", err)
			}
			if ae.Code != tc.wantCode {
				t.Fatalf("code = %q, want %q", ae.Code, tc.wantCode)
			}
		})
	}
}

func TestResolveInternalAPIBase(t *testing.T) {
	t.Setenv("TOOL_API_BASE_DORMGUARD", "http://127.0.0.1:8000")
	got := ResolveInternalAPIBase("dormguard", "http://ignored:9999")
	if got != "http://127.0.0.1:8000" {
		t.Fatalf("got %q", got)
	}
	got = ResolveInternalAPIBase("other", "http://db:3000/")
	if got != "http://db:3000" {
		t.Fatalf("got %q", got)
	}
}
