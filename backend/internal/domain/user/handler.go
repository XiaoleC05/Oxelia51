package user

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserHandler 用户个人资料接口
type UserHandler struct {
	db   *pgxpool.Pool
	repo *Repository
}

func NewUserHandler(db *pgxpool.Pool, repo *Repository) *UserHandler {
	return &UserHandler{db: db, repo: repo}
}

func (h *UserHandler) Me(c *gin.Context) {
	userID := c.GetInt64("userID")
	if userID == 0 {
		infra.ApiError(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	user, err := h.repo.FetchByID(ctx, fmt.Sprintf("%d", userID))
	if err != nil {
		infra.ApiError(c, http.StatusNotFound, "NOT_FOUND", "用户不存在")
		return
	}
	user.Password = ""
	c.JSON(http.StatusOK, user)
}

// PatchProfile PATCH /api/auth/profile — 允许用户修改自己的 username（显示名）
func (h *UserHandler) PatchProfile(c *gin.Context) {
	userID := c.GetInt64("userID")
	if userID == 0 {
		infra.ApiError(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}

	var req PatchProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	if req.Username == nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "至少提供一个要修改的字段")
		return
	}
	if strings.TrimSpace(*req.Username) == "" {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "用户名不能为空")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var updated User
	err := h.db.QueryRow(ctx,
		`UPDATE users SET username = COALESCE($2, username), updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, account_id, username, password, email, role, email_verified, created_at, updated_at`,
		userID, req.Username,
	).Scan(
		&updated.ID, &updated.AccountID, &updated.Username, &updated.Password,
		&updated.Email, &updated.Role, &updated.EmailVerified,
		&updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}
	updated.Password = ""
	c.JSON(http.StatusOK, updated)
}
