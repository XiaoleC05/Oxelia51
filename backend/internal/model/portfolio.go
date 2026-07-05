package model

// PortfolioItem 对应 portfolio_items 表
type PortfolioItem struct {
	Slug                string  `json:"slug"`
	Name                string  `json:"name"`
	Description         string  `json:"description"`
	GithubRepo          string  `json:"github_repo"`
	SourceDir           string  `json:"source_dir"`
	NameOverride        *string `json:"name_override"`
	DescriptionOverride *string `json:"description_override"`
	LinkedToolSlug      *string `json:"linked_tool_slug"`
}

// UpdatePortfolioRequest 管理端 PUT 请求
type UpdatePortfolioRequest struct {
	NameOverride        *string `json:"name_override"`
	DescriptionOverride *string `json:"description_override"`
}
