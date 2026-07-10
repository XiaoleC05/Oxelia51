package model

import "time"

// DeveloperProfile 关于开发者单行配置
type DeveloperProfile struct {
	ID        int64     `json:"id"`
	Bio       string    `json:"bio"`
	Resume    string    `json:"resume"`
	AvatarURL string    `json:"avatar_url"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PatchDeveloperProfileRequest 更新开发者信息
type PatchDeveloperProfileRequest struct {
	Bio       *string `json:"bio"`
	Resume    *string `json:"resume"`
	AvatarURL *string `json:"avatar_url"`
}
