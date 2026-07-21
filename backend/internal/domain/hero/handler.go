package hero

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HeroHandler 首页头图轮播
type HeroHandler struct {
	db        *pgxpool.Pool
	uploadDir string
}

var allowedImageExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
}

func NewHeroHandler(db *pgxpool.Pool) *HeroHandler {
	dir := os.Getenv("HERO_UPLOAD_DIR")
	if dir == "" {
		dir = "/opt/Oxelia51/uploads/hero-images"
	}
	if err := os.MkdirAll(dir, 0750); err != nil {
		log.Printf("警告: 创建上传目录失败 %s: %v", dir, err)
	}
	return &HeroHandler{db: db, uploadDir: dir}
}

func (h *HeroHandler) ListPublic(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, image_url, title, subtitle, display_order, enabled, created_at, updated_at
		FROM hero_images
		WHERE enabled = TRUE
		ORDER BY display_order, id`)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []HeroImage{}
	for rows.Next() {
		var item HeroImage
		if err := rows.Scan(
			&item.ID, &item.ImageURL, &item.Title, &item.Subtitle,
			&item.DisplayOrder, &item.Enabled, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	var intervalMs int
	_ = h.db.QueryRow(ctx, `SELECT autoplay_interval_ms FROM carousel_settings WHERE id = 1`).Scan(&intervalMs)
	if intervalMs <= 0 {
		intervalMs = 5000
	}

	c.JSON(http.StatusOK, gin.H{
		"images":               items,
		"autoplay_interval_ms": intervalMs,
	})
}

func (h *HeroHandler) ListAdmin(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, image_url, title, subtitle, display_order, enabled, created_at, updated_at
		FROM hero_images
		ORDER BY display_order, id`)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []HeroImage{}
	for rows.Next() {
		var item HeroImage
		if err := rows.Scan(
			&item.ID, &item.ImageURL, &item.Title, &item.Subtitle,
			&item.DisplayOrder, &item.Enabled, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

func (h *HeroHandler) Create(c *gin.Context) {
	var req CreateHeroImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item HeroImage
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
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "创建失败")
		return
	}

	c.JSON(http.StatusCreated, item)
}

func (h *HeroHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateHeroImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item HeroImage
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
			infra.ApiError(c, http.StatusNotFound, "HERO_NOT_FOUND", "头图不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}

func (h *HeroHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var imageURL string
	err := h.db.QueryRow(ctx, `SELECT image_url FROM hero_images WHERE id = $1`, id).Scan(&imageURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			infra.ApiError(c, http.StatusNotFound, "HERO_NOT_FOUND", "头图不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	result, err := h.db.Exec(ctx, `DELETE FROM hero_images WHERE id = $1`, id)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "删除失败")
		return
	}
	if result.RowsAffected() == 0 {
		infra.ApiError(c, http.StatusNotFound, "HERO_NOT_FOUND", "头图不存在")
		return
	}

	if len(imageURL) > 9 && imageURL[:9] == "/uploads/" {
		diskPath := filepath.Join("/opt/Oxelia51/uploads", imageURL[9:])
		if removeErr := os.Remove(diskPath); removeErr != nil && !os.IsNotExist(removeErr) {
			log.Printf("警告: 删除磁盘文件失败 %s: %v", diskPath, removeErr)
		}
	}

	c.Status(http.StatusNoContent)
}

func (h *HeroHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "缺少文件")
		return
	}

	if file.Size > 10<<20 {
		infra.ApiError(c, http.StatusBadRequest, "FILE_TOO_LARGE", "文件不能超过 10MB")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedImageExt[ext] {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_FILE_TYPE", "仅允许 jpg/jpeg/png/gif/webp 格式")
		return
	}

	randBytes := make([]byte, 4)
	_, _ = rand.Read(randBytes)
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), hex.EncodeToString(randBytes), ext)
	dst := filepath.Join(h.uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "保存文件失败")
		return
	}

	_ = os.Chmod(dst, 0640)

	c.JSON(http.StatusCreated, gin.H{
		"url":      "/uploads/hero-images/" + filename,
		"filename": filename,
		"size":     file.Size,
	})
}

func (h *HeroHandler) UpdateCarouselSettings(c *gin.Context) {
	var req struct {
		AutoplayIntervalMs *int `json:"autoplay_interval_ms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}
	if req.AutoplayIntervalMs == nil || *req.AutoplayIntervalMs < 1000 || *req.AutoplayIntervalMs > 60000 {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_INTERVAL", "轮播间隔需在 1000-60000 毫秒之间")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := h.db.Exec(ctx, `
		UPDATE carousel_settings SET autoplay_interval_ms = $1, updated_at = NOW() WHERE id = 1`,
		*req.AutoplayIntervalMs)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"autoplay_interval_ms": *req.AutoplayIntervalMs,
	})
}
