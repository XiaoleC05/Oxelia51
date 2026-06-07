package model

import "time"

// Tool 对应数据库 tools 表
type Tool struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateToolRequest 创建工具请求体
type CreateToolRequest struct {
	Name        string `json:"name"        binding:"required,min=1,max=128"`
	Description string `json:"description" binding:"max=1024"`
	Status      string `json:"status"`
}

// UpdateToolRequest 更新工具请求体
type UpdateToolRequest struct {
	Name        string `json:"name"        binding:"max=128"`
	Description string `json:"description" binding:"max=1024"`
	Status      string `json:"status"`
}
