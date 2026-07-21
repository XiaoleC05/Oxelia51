package hero

import "time"

// HeroImage 首页头图轮播项
type HeroImage struct {
	ID           int64     `json:"id"`
	ImageURL     string    `json:"image_url"`
	Title        string    `json:"title"`
	Subtitle     string    `json:"subtitle"`
	DisplayOrder int       `json:"display_order"`
	Enabled      bool      `json:"enabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CreateHeroImageRequest 创建头图
type CreateHeroImageRequest struct {
	ImageURL     string `json:"image_url" binding:"required"`
	Title        string `json:"title"`
	Subtitle     string `json:"subtitle"`
	DisplayOrder int    `json:"display_order"`
}

// UpdateHeroImageRequest 更新头图
type UpdateHeroImageRequest struct {
	ImageURL     *string `json:"image_url"`
	Title        *string `json:"title"`
	Subtitle     *string `json:"subtitle"`
	DisplayOrder *int    `json:"display_order"`
	Enabled      *bool   `json:"enabled"`
}
