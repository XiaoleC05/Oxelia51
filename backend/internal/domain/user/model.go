package user

import "time"

// User 对应数据库 users 表
type User struct {
	ID            int64     `json:"id"`
	AccountID     string    `json:"account_id"`
	Username      string    `json:"username"`
	Password      string    `json:"-"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// PatchProfileRequest 用户修改自己的显示名（username）
type PatchProfileRequest struct {
	Username *string `json:"username" binding:"omitempty,min=3,max=64"`
}

// AdminUserItem 管理端用户列表项
type AdminUserItem struct {
	ID            int64     `json:"id"`
	AccountID     string    `json:"account_id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// PatchUserRequest 管理端 PATCH 用户
type PatchUserRequest struct {
	EmailVerified *bool   `json:"email_verified"`
	Role          *string `json:"role"`
}

// DeleteUserRequest 管理端 DELETE 用户（需确认）
type DeleteUserRequest struct {
	Confirm   string `json:"confirm" binding:"required"`
	AccountID string `json:"account_id" binding:"required"`
}
