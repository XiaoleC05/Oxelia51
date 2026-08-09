package proxy

import (
	"bytes"
	"compress/gzip"
	"testing"
)

// TestDecodeBody 锁住 #1：gzip 响应必须被解压成可解析的明文 JSON。
func TestDecodeBody(t *testing.T) {
	plain := []byte(`{"usage":{"prompt_tokens":777,"completion_tokens":333,"total_tokens":1110}}`)

	// 构造 gzip 字节
	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	zw.Write(plain)
	zw.Close()

	cases := []struct {
		name     string
		raw      []byte
		encoding string
		want     []byte
	}{
		{"identity 原样返回", plain, "identity", plain},
		{"空 encoding 原样返回", plain, "", plain},
		{"gzip 解压", gz.Bytes(), "gzip", plain},
		{"gzip 大小写不敏感", gz.Bytes(), "GZIP", plain},
		{"声称 gzip 但不是 gzip → 回退原字节", []byte("not gzip"), "gzip", []byte("not gzip")},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := decodeBody(c.raw, c.encoding)
			if !bytes.Equal(got, c.want) {
				t.Fatalf("decodeBody got %q, want %q", got, c.want)
			}
		})
	}
}
