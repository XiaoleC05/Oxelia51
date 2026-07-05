package registry

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadManifest(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ManifestFileName)
	content := `{
  "slug": "dormguard",
  "name": "DormGuard",
  "description": "测试描述",
  "online_capable": true,
  "github_repo": "XiaoleC05/DormGuard",
  "release_url": "https://github.com/XiaoleC05/DormGuard/releases"
}`
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	m, err := ReadManifest(path)
	if err != nil {
		t.Fatal(err)
	}
	if m.Slug != "dormguard" || !m.OnlineCapable {
		t.Fatalf("unexpected manifest: %+v", m)
	}
}

func TestReadManifestMissingSlug(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ManifestFileName)
	if err := os.WriteFile(path, []byte(`{"name":"X"}`), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadManifest(path); err == nil {
		t.Fatal("expected error for missing slug")
	}
}

func TestSlugFromDirName(t *testing.T) {
	cases := map[string]string{
		"XiaoleC05.github.io": "xiaolec05-github-io",
		"Oxelia51":            "oxelia51",
		"DormGuard":           "dormguard",
	}
	for input, want := range cases {
		if got := SlugFromDirName(input); got != want {
			t.Errorf("SlugFromDirName(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestComputeBadge(t *testing.T) {
	if ComputeBadge("disabled", true) != "offline" {
		t.Fatal("disabled badge")
	}
	if ComputeBadge("enabled", false) != "closed_to_users" {
		t.Fatal("closed badge")
	}
	if ComputeBadge("enabled", true) != "open" {
		t.Fatal("open badge")
	}
}
