package model

import (
	"time"
)

// Article 文章展示项（博客合并）
type Article struct {
	ID           int64      `json:"id"`
	Title        string     `json:"title"`
	URL          string     `json:"url"`
	Summary      string     `json:"summary"`
	Category     string     `json:"category"`
	PublishedAt  *time.Time `json:"published_at"`
	DisplayOrder int        `json:"display_order"`
	Enabled      bool       `json:"enabled"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// CreateArticleRequest 创建文章
type CreateArticleRequest struct {
	Title        string     `json:"title" binding:"required"`
	URL          string     `json:"url" binding:"required"`
	Summary      string     `json:"summary"`
	Category     string     `json:"category"`
	PublishedAt  *time.Time `json:"published_at"`
	DisplayOrder int        `json:"display_order"`
}

// UpdateArticleRequest 更新文章
type UpdateArticleRequest struct {
	Title        *string    `json:"title"`
	URL          *string    `json:"url"`
	Summary      *string    `json:"summary"`
	Category     *string    `json:"category"`
	PublishedAt  *time.Time `json:"published_at"`
	DisplayOrder *int       `json:"display_order"`
	Enabled      *bool      `json:"enabled"`
}
