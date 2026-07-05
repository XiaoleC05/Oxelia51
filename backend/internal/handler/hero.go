package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HeroHandler 首页头图轮播
type HeroHandler struct {
	db        *pgxpool.Pool
	uploadDir string
}

func NewHeroHandler(db *pgxpool.Pool) *HeroHandler {
	dir := "/opt/Oxelia51/uploads/hero-images"
	_ = os.MkdirAll(dir, 0755)
	return &HeroHandler{db: db, uploadDir: dir}
}

// ListPublic GET /api/hero-images — 公开列表（仅 enabled，按 order 排序）
func (h *HeroHandler) ListPublic(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, image_url, title, subtitle, display_order, enabled, created_at, updated_at
		FROM hero_images
		WHERE enabled = TRUE
		ORDER BY display_order, id`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.HeroImage{}
	for rows.Next() {
		var item model.HeroImage
		if err := rows.Scan(
			&item.ID, &item.ImageURL, &item.Title, &item.Subtitle,
			&item.DisplayOrder, &item.Enabled, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// ListAdmin GET /api/admin/hero-images — 管理端列表（全部）
func (h *HeroHandler) ListAdmin(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, image_url, title, subtitle, display_order, enabled, created_at, updated_at
		FROM hero_images
		ORDER BY display_order, id`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.HeroImage{}
	for rows.Next() {
		var item model.HeroImage
		if err := rows.Scan(
			&item.ID, &item.ImageURL, &item.Title, &item.Subtitle,
			&item.DisplayOrder, &item.Enabled, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// Create POST /api/admin/hero-images
func (h *HeroHandler) Create(c *gin.Context) {
	var req model.CreateHeroImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.HeroImage
	err := h.db.QueryRow(ctx, `
		INSERT INTO hero_images (image_url, title, subtitle, display_order, enabled)
		VALUES ($1, $2, $3, $4, TRUE)
		RETURNING id, image_url, title, subtitle, display_order, enabled, created_at, updated_at`,
		req.ImageURL, req.Title, req.Subtitle, req.DisplayOrder,
	).Scan(
		&item.ID, &item.ImageURL, &item.Title, &item.Subtitle,
		&item.DisplayOrder, &item.Enabled, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "创建失败")
		return
	}

	c.JSON(http.StatusCreated, item)
}

// Update PUT /api/admin/hero-images/:id
func (h *HeroHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req model.UpdateHeroImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.HeroImage
	err := h.db.QueryRow(ctx, `
		UPDATE hero_images SET
			image_url = COALESCE($2, image_url),
			title = COALESCE($3, title),
			subtitle = COALESCE($4, subtitle),
			display_order = COALESCE($5, display_order),
			enabled = COALESCE($6, enabled),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, image_url, title, subtitle, display_order, enabled, created_at, updated_at`,
		id, req.ImageURL, req.Title, req.Subtitle, req.DisplayOrder, req.Enabled,
	).Scan(
		&item.ID, &item.ImageURL, &item.Title, &item.Subtitle,
		&item.DisplayOrder, &item.Enabled, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "HERO_NOT_FOUND", "头图不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}

// Delete DELETE /api/admin/hero-images/:id
func (h *HeroHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	result, err := h.db.Exec(ctx, `DELETE FROM hero_images WHERE id = $1`, id)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "删除失败")
		return
	}
	if result.RowsAffected() == 0 {
		apiError(c, http.StatusNotFound, "HERO_NOT_FOUND", "头图不存在")
		return
	}

	c.Status(http.StatusNoContent)
}

// Upload POST /api/admin/hero-images/upload — 上传图片文件
func (h *HeroHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "缺少文件")
		return
	}

	// 限制 10MB
	if file.Size > 10<<20 {
		apiError(c, http.StatusBadRequest, "FILE_TOO_LARGE", "文件不能超过 10MB")
		return
	}

	// 生成唯一文件名
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dst := filepath.Join(h.uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "保存文件失败")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"url":      "/uploads/hero-images/" + filename,
		"filename": filename,
		"size":     file.Size,
	})
}
