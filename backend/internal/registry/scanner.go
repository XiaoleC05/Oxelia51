package registry

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ScanResult 本地扫描结果摘要
type ScanResult struct {
	Scanned           int      `json:"scanned"`
	ToolsUpserted     int      `json:"tools_upserted"`
	PortfolioUpserted int      `json:"portfolio_upserted"`
	Warnings          []string `json:"warnings"`
	Errors            []string `json:"errors"`
}

type dirEntry struct {
	dirName      string
	sourceDir    string
	manifestPath string
	manifest     *Manifest
}

// ScanLocal 扫描 code 根目录一级子目录，写入 portfolio_items 与 tools
func ScanLocal(ctx context.Context, db *pgxpool.Pool, codeRoot string) (*ScanResult, error) {
	result := &ScanResult{}

	entries, err := os.ReadDir(codeRoot)
	if err != nil {
		return nil, fmt.Errorf("读取目录 %s 失败: %w", codeRoot, err)
	}

	seenSlugs := map[string]string{}
	var dirs []dirEntry

	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}

		result.Scanned++
		sourceDir := filepath.Join(codeRoot, e.Name())
		manifestPath := filepath.Join(sourceDir, ManifestFileName)

		de := dirEntry{
			dirName:   e.Name(),
			sourceDir: sourceDir,
		}

		if _, err := os.Stat(manifestPath); err == nil {
			m, err := ReadManifest(manifestPath)
			if err != nil {
				result.Warnings = append(result.Warnings, fmt.Sprintf("%s: %v", e.Name(), err))
				continue
			}
			de.manifestPath = manifestPath
			de.manifest = m
		}

		slug := de.slug()
		if prev, ok := seenSlugs[slug]; ok {
			result.Errors = append(result.Errors,
				fmt.Sprintf("slug 冲突: %q 同时出现在 %s 与 %s", slug, prev, e.Name()))
			continue
		}
		seenSlugs[slug] = e.Name()
		dirs = append(dirs, de)
	}

	if len(result.Errors) > 0 {
		return result, fmt.Errorf("扫描发现 slug 冲突")
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	for _, de := range dirs {
		if err := upsertPortfolio(ctx, tx, de, result); err != nil {
			return nil, err
		}
		if de.manifest != nil && de.manifest.OnlineCapable {
			if err := upsertTool(ctx, tx, de, result); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func (de dirEntry) slug() string {
	if de.manifest != nil {
		return de.manifest.Slug
	}
	return SlugFromDirName(de.dirName)
}

func (de dirEntry) name() string {
	if de.manifest != nil {
		return de.manifest.Name
	}
	return de.dirName
}

func (de dirEntry) description() string {
	if de.manifest != nil {
		return de.manifest.Description
	}
	return ""
}

func (de dirEntry) githubRepo() string {
	if de.manifest != nil {
		return de.manifest.GithubRepo
	}
	return ""
}

func upsertPortfolio(ctx context.Context, tx pgx.Tx, de dirEntry, result *ScanResult) error {
	slug := de.slug()
	var linked *string
	if de.manifest != nil && de.manifest.OnlineCapable {
		linked = &slug
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO portfolio_items (slug, name, description, github_repo, source_dir, linked_tool_slug)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (slug) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			github_repo = EXCLUDED.github_repo,
			source_dir = EXCLUDED.source_dir,
			linked_tool_slug = EXCLUDED.linked_tool_slug`,
		slug, de.name(), de.description(), de.githubRepo(), de.sourceDir, linked,
	)
	if err != nil {
		return fmt.Errorf("写入 portfolio %s 失败: %w", slug, err)
	}
	result.PortfolioUpserted++
	return nil
}

func upsertTool(ctx context.Context, tx pgx.Tx, de dirEntry, result *ScanResult) error {
	m := de.manifest
	_, err := tx.Exec(ctx, `
		INSERT INTO tools (
			slug, name, description, online_capable, github_repo, release_url,
			manifest_path, status, user_accessible
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'enabled', FALSE)
		ON CONFLICT (slug) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			online_capable = EXCLUDED.online_capable,
			github_repo = EXCLUDED.github_repo,
			release_url = EXCLUDED.release_url,
			manifest_path = EXCLUDED.manifest_path,
			updated_at = NOW()`,
		m.Slug, m.Name, m.Description, m.OnlineCapable,
		m.GithubRepo, m.ReleaseURL, de.manifestPath,
	)
	if err != nil {
		return fmt.Errorf("写入 tool %s 失败: %w", m.Slug, err)
	}
	result.ToolsUpserted++
	return nil
}
