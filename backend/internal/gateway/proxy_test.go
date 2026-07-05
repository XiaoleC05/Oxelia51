package gateway

import (
	"bytes"
	"errors"
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
