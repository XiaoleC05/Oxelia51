package auth

// LoginRequest 登录请求体（v1.2 改为 account 字段，支持 account_id 或 email）
type LoginRequest struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RefreshRequest 刷新 token
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// LogoutRequest 登出（可选携带 refresh_token 以便服务端吊销）
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}
