package auth

// RegisterRequest 注册请求体（v1.2 新增 account_id）
type RegisterRequest struct {
	AccountID       string `json:"account_id" binding:"required,min=4,max=32"`
	Username        string `json:"username" binding:"required,min=3,max=64"`
	Password        string `json:"password" binding:"required,min=8,max=128"`
	PasswordConfirm string `json:"password_confirm" binding:"required"`
	Email           string `json:"email" binding:"required,email,max=128"`
}

// LoginRequest 登录请求体（v1.2 改为 account 字段，支持 account_id 或 email）
type LoginRequest struct {
	Account  string `json:"account" binding:"required"`
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

// PendingRegistration 暂存注册数据（Redis），邮箱验证后写入 DB
type PendingRegistration struct {
	AccountID string `json:"account_id"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	Email     string `json:"email"`
}
