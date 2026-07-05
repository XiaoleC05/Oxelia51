package gateway

import (
	"bytes"
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestReadLimitedBody(t *testing.T) {
	t.Run("within limit", func(t *testing.T) {
		data, err := readLimitedBody(strings.NewReader("hello"), 10)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(data, []byte("hello")) {
			t.Fatalf("got %q", data)
		}
	})

	t.Run("exact limit", func(t *testing.T) {
		payload := strings.Repeat("a", 5)
		data, err := readLimitedBody(strings.NewReader(payload), 5)
		if err != nil {
			t.Fatal(err)
		}
		if len(data) != 5 {
			t.Fatalf("len = %d", len(data))
		}
	})

	t.Run("over limit", func(t *testing.T) {
		payload := strings.Repeat("b", 6)
		_, err := readLimitedBody(strings.NewReader(payload), 5)
		if !errors.Is(err, errResponseTooLarge) {
			t.Fatalf("expected errResponseTooLarge, got %v", err)
		}
	})
}

func TestCopyHeaders_StripsClientIPForwardHeaders(t *testing.T) {
	src := http.Header{}
	src.Set("X-Real-IP", "47.108.202.199")
	src.Set("X-Forwarded-For", "1.2.3.4, 5.6.7.8")
	src.Set("X-Forwarded-Proto", "https")
	src.Set("X-Forwarded-Host", "oxelia51.com")
	src.Set("X-Forwarded-Port", "443")
	src.Set("X-Forwarded-Server", "edge01")
	src.Set("X-Client-IP", "9.9.9.9")
	src.Set("X-Original-Forwarded-For", "8.8.8.8")
	src.Set("Forwarded", `for=1.2.3.4;proto=https`)
	// 大小写无关
	src.Set("x-real-ip", "10.0.0.1")
	// 必须保留的业务头
	src.Set("Content-Type", "application/json")
	src.Set("X-Custom-Header", "keep-me")
	// Authorization 必须被剥离（由 injectGatewayHeaders 注入 X-Oxelia51-*）
	src.Set("Authorization", "Bearer leak")

	dst := http.Header{}
	copyHeaders(dst, src)

	for _, h := range []string{
		"X-Real-IP",
		"X-Forwarded-For",
		"X-Forwarded-Proto",
		"X-Forwarded-Host",
		"X-Forwarded-Port",
		"X-Forwarded-Server",
		"X-Client-IP",
		"X-Original-Forwarded-For",
		"Forwarded",
		"Authorization",
	} {
		if dst.Get(h) != "" {
			t.Errorf("header %q should be stripped, got %q", h, dst.Get(h))
		}
	}

	if ct := dst.Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type lost: %q", ct)
	}
	if ch := dst.Get("X-Custom-Header"); ch != "keep-me" {
		t.Errorf("X-Custom-Header lost: %q", ch)
	}
}

func TestCopyResponseHeaders_KeepsClientIPHeaders(t *testing.T) {
	// 响应方向不应剥离（最小改动原则，且响应里这些头罕见）
	src := http.Header{}
	src.Set("X-Real-IP", "47.108.202.199")
	src.Set("Content-Type", "application/json")

	dst := http.Header{}
	copyResponseHeaders(dst, src)

	if dst.Get("X-Real-IP") != "47.108.202.199" {
		t.Errorf("response copyHeaders should NOT strip X-Real-IP, got %q", dst.Get("X-Real-IP"))
	}
	if dst.Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type lost in response copy: %q", dst.Get("Content-Type"))
	}
}

func TestIsClientIPForwardHeader(t *testing.T) {
	cases := map[string]bool{
		"X-Real-IP":                true,
		"x-real-ip":                true,
		"X-REAL-IP":                true,
		"X-Forwarded-For":          true,
		"Forwarded":                true,
		"forwarded":                true,
		"X-Forwarded-Host":         true,
		"X-Original-Forwarded-For": true,
		"X-Custom-IP":              false,
		"Content-Type":             false,
		"":                         false,
	}
	for h, want := range cases {
		if got := isClientIPForwardHeader(h); got != want {
			t.Errorf("isClientIPForwardHeader(%q) = %v, want %v", h, got, want)
		}
	}
}
