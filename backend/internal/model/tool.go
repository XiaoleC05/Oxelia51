package model

import "time"

// Tool 对应数据库 tools 表（v1.1）
type Tool struct {
	ID                  int64     `json:"-"`
	Slug                string    `json:"slug"`
	Name                string    `json:"name"`
	Description         string    `json:"description"`
	UserAccessible      bool      `json:"user_accessible"`
	OnlineCapable       bool      `json:"online_capable"`
	Status              string    `json:"status"`
	InternalAPIBase     string    `json:"-"`
	GithubRepo          string    `json:"-"`
	ReleaseURL          string    `json:"release_url"`
	ManifestPath        string    `json:"-"`
	DescriptionOverride *string   `json:"-"`
	CreatedAt           time.Time `json:"-"`
	UpdatedAt           time.Time `json:"-"`
}

// ToolListItem 公开工具目录项
type ToolListItem struct {
	Slug            string `json:"slug"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	UserAccessible  bool   `json:"user_accessible"`
	Status          string `json:"status"`
	ReleaseURL      string `json:"release_url"`
	OnlineCapable   bool   `json:"online_capable"`
	Badge           string `json:"badge"`
}

// AdminToolDetail 管理端工具详情
type AdminToolDetail struct {
	Slug                string  `json:"slug"`
	Name                string  `json:"name"`
	Description         string  `json:"description"`
	UserAccessible      bool    `json:"user_accessible"`
	OnlineCapable       bool    `json:"online_capable"`
	Status              string  `json:"status"`
	InternalAPIBase     string  `json:"internal_api_base"`
	GithubRepo          string  `json:"github_repo"`
	ReleaseURL          string  `json:"release_url"`
	ManifestPath        string  `json:"manifest_path"`
	DescriptionOverride *string `json:"description_override"`
}

// PatchToolRequest 管理端 PATCH 请求
type PatchToolRequest struct {
	UserAccessible      *bool   `json:"user_accessible"`
	Status              *string `json:"status"`
	DescriptionOverride *string `json:"description_override"`
	InternalAPIBase     *string `json:"internal_api_base"`
}
