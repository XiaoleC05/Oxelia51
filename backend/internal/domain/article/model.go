package article

import "time"

// Article 文章展示项（博客合并）
type Article struct {
	ID            int64      `json:"id"`
	Title         string     `json:"title"`
	URL           string     `json:"url"`
	Summary       string     `json:"summary"`
	Content       string     `json:"content"`
	Category      string     `json:"category"`
	Tags          []string   `json:"tags"`
	IsDraft       bool       `json:"is_draft"`
	PublishedAt   *time.Time `json:"published_at"`
	DisplayOrder  int        `json:"display_order"`
	Enabled       bool       `json:"enabled"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// ArticleListItem 文章列表项（不含正文，减少传输量）
type ArticleListItem struct {
	ID            int64      `json:"id"`
	Title         string     `json:"title"`
	Summary       string     `json:"summary"`
	Category      string     `json:"category"`
	Tags          []string   `json:"tags"`
	PublishedAt   *time.Time `json:"published_at"`
	DisplayOrder  int        `json:"display_order"`
}

// CreateArticleRequest 创建文章
type CreateArticleRequest struct {
	Title        string     `json:"title" binding:"required"`
	URL          string     `json:"url"`
	Summary      string     `json:"summary"`
	Content      string     `json:"content"`
	Category     string     `json:"category"`
	Tags         []string   `json:"tags"`
	IsDraft      bool       `json:"is_draft"`
	PublishedAt  *time.Time `json:"published_at"`
	DisplayOrder int        `json:"display_order"`
}

// UpdateArticleRequest 更新文章
type UpdateArticleRequest struct {
	Title        *string    `json:"title"`
	URL          *string    `json:"url"`
	Summary      *string    `json:"summary"`
	Content      *string    `json:"content"`
	Category     *string    `json:"category"`
	Tags         []string   `json:"tags"`
	IsDraft      *bool      `json:"is_draft"`
	PublishedAt  *time.Time `json:"published_at"`
	DisplayOrder *int       `json:"display_order"`
	Enabled      *bool      `json:"enabled"`
}

// Page 静态页面
type Page struct {
	ID        int64     `json:"id"`
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdatePageRequest 更新页面
type UpdatePageRequest struct {
	Title   *string `json:"title"`
	Content *string `json:"content"`
	Enabled *bool   `json:"enabled"`
}
