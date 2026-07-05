package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const ManifestFileName = "oxelia51.tool.json"

var slugSanitizer = regexp.MustCompile(`[^a-z0-9]+`)

// Manifest 工具 manifest 文件结构（v1.1）
type Manifest struct {
	Slug           string `json:"slug"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	OnlineCapable  bool   `json:"online_capable"`
	GithubRepo     string `json:"github_repo"`
	ReleaseURL     string `json:"release_url"`
}

// ReadManifest 读取并解析 manifest 文件
func ReadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取 manifest 失败: %w", err)
	}

	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("解析 manifest 失败: %w", err)
	}

	dirName := filepath.Base(filepath.Dir(path))
	if strings.TrimSpace(m.Slug) == "" {
		return nil, fmt.Errorf("manifest 缺少 slug（目录: %s）", dirName)
	}
	if strings.TrimSpace(m.Name) == "" {
		m.Name = dirName
	}

	return &m, nil
}

// SlugFromDirName 无 manifest 时从目录名生成 slug
func SlugFromDirName(dirName string) string {
	s := strings.ToLower(dirName)
	s = slugSanitizer.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return dirName
	}
	return s
}
