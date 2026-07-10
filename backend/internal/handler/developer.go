package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DeveloperHandler 关于开发者信息
type DeveloperHandler struct {
	db *pgxpool.Pool
}

func NewDeveloperHandler(db *pgxpool.Pool) *DeveloperHandler {
	return &DeveloperHandler{db: db}
}

// GetProfile GET /api/developer/profile — 公开，无需认证
func (h *DeveloperHandler) GetProfile(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var profile model.DeveloperProfile
	err := h.db.QueryRow(ctx, `
		SELECT id, bio, resume, avatar_url, updated_at
		FROM developer_profile
		WHERE id = 1`,
	).Scan(&profile.ID, &profile.Bio, &profile.Resume, &profile.AvatarURL, &profile.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "PROFILE_NOT_FOUND", "开发者信息未配置")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	c.JSON(http.StatusOK, profile)
}

// GetProfileAdmin GET /api/admin/developer/profile — 仅管理员，返回完整资料
func (h *DeveloperHandler) GetProfileAdmin(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var profile model.DeveloperProfile
	err := h.db.QueryRow(ctx, `
		SELECT id, bio, resume, avatar_url, updated_at
		FROM developer_profile
		WHERE id = 1`,
	).Scan(&profile.ID, &profile.Bio, &profile.Resume, &profile.AvatarURL, &profile.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "PROFILE_NOT_FOUND", "开发者信息未配置")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	c.JSON(http.StatusOK, profile)
}

// PatchProfile PATCH /api/admin/developer/profile — 仅管理员
func (h *DeveloperHandler) PatchProfile(c *gin.Context) {
	var req model.PatchDeveloperProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var profile model.DeveloperProfile
	err := h.db.QueryRow(ctx, `
		UPDATE developer_profile SET
			bio = COALESCE($2, bio),
			resume = COALESCE($3, resume),
			avatar_url = COALESCE($4, avatar_url),
			updated_at = NOW()
		WHERE id = 1
		RETURNING id, bio, resume, avatar_url, updated_at`,
		"unused", req.Bio, req.Resume, req.AvatarURL,
	).Scan(&profile.ID, &profile.Bio, &profile.Resume, &profile.AvatarURL, &profile.UpdatedAt)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, profile)
}
