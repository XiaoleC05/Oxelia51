package model

import "time"

// User 对应数据库 users 表
type User struct {
	ID            int64     `json:"id"`
	Username      string    `json:"username"`
	Password      string    `json:"-"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// RegisterRequest 注册请求体（v1.1）
type RegisterRequest struct {
	Username        string `json:"username" binding:"required,min=3,max=64"`
	Password        string `json:"password" binding:"required,min=8,max=128"`
	PasswordConfirm string `json:"password_confirm" binding:"required"`
	Email           string `json:"email" binding:"required,email,max=128"`
}

// LoginRequest 登录请求体
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ResendVerificationRequest 重发验证邮件
type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ForgotPasswordRequest 忘记密码
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordRequest 重置密码
type ResetPasswordRequest struct {
	Token           string `json:"token" binding:"required"`
	Password        string `json:"password" binding:"required,min=8,max=128"`
	PasswordConfirm string `json:"password_confirm" binding:"required"`
}

// RefreshRequest 刷新 token
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// LogoutRequest 登出（可选携带 refresh_token 以便服务端吊销）
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// AdminUserItem 管理端用户列表项
type AdminUserItem struct {
	ID            int64     `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
}

// PatchUserRequest 管理端 PATCH 用户
type PatchUserRequest struct {
	EmailVerified *bool   `json:"email_verified"`
	Role          *string `json:"role"`
}
