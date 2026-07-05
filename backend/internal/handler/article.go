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

// ArticleHandler 文章展示
type ArticleHandler struct {
	db *pgxpool.Pool
}

func NewArticleHandler(db *pgxpool.Pool) *ArticleHandler {
	return &ArticleHandler{db: db}
}

// ListPublic GET /api/articles — 公开列表（仅 enabled，按 order 排序）
func (h *ArticleHandler) ListPublic(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, title, url, summary, category, published_at, display_order, enabled, created_at, updated_at
		FROM articles
		WHERE enabled = TRUE
		ORDER BY display_order, published_at DESC NULLS LAST, id`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.Article{}
	for rows.Next() {
		var item model.Article
		if err := rows.Scan(
			&item.ID, &item.Title, &item.URL, &item.Summary, &item.Category,
			&item.PublishedAt, &item.DisplayOrder, &item.Enabled,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// ListAdmin GET /api/admin/articles — 管理端列表（全部）
func (h *ArticleHandler) ListAdmin(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, title, url, summary, category, published_at, display_order, enabled, created_at, updated_at
		FROM articles
		ORDER BY display_order, id`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.Article{}
	for rows.Next() {
		var item model.Article
		if err := rows.Scan(
			&item.ID, &item.Title, &item.URL, &item.Summary, &item.Category,
			&item.PublishedAt, &item.DisplayOrder, &item.Enabled,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// Create POST /api/admin/articles
func (h *ArticleHandler) Create(c *gin.Context) {
	var req model.CreateArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}
	// URL 基础格式校验
	if len(req.URL) < 8 || (req.URL[:4] != "http" && req.URL[:2] != "//") {
		apiError(c, http.StatusBadRequest, "INVALID_URL", "URL 格式无效，需以 http 开头")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.Article
	err := h.db.QueryRow(ctx, `
		INSERT INTO articles (title, url, summary, category, published_at, display_order, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE)
		RETURNING id, title, url, summary, category, published_at, display_order, enabled, created_at, updated_at`,
		req.Title, req.URL, req.Summary, req.Category, req.PublishedAt, req.DisplayOrder,
	).Scan(
		&item.ID, &item.Title, &item.URL, &item.Summary, &item.Category,
		&item.PublishedAt, &item.DisplayOrder, &item.Enabled,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "创建失败")
		return
	}

	c.JSON(http.StatusCreated, item)
}

// Update PUT /api/admin/articles/:id
func (h *ArticleHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req model.UpdateArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.Article
	err := h.db.QueryRow(ctx, `
		UPDATE articles SET
			title = COALESCE($2, title),
			url = COALESCE($3, url),
			summary = COALESCE($4, summary),
			category = COALESCE($5, category),
			published_at = COALESCE($6, published_at),
			display_order = COALESCE($7, display_order),
			enabled = COALESCE($8, enabled),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, title, url, summary, category, published_at, display_order, enabled, created_at, updated_at`,
		id, req.Title, req.URL, req.Summary, req.Category, req.PublishedAt, req.DisplayOrder, req.Enabled,
	).Scan(
		&item.ID, &item.Title, &item.URL, &item.Summary, &item.Category,
		&item.PublishedAt, &item.DisplayOrder, &item.Enabled,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "ARTICLE_NOT_FOUND", "文章不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}

// Delete DELETE /api/admin/articles/:id
func (h *ArticleHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	result, err := h.db.Exec(ctx, `DELETE FROM articles WHERE id = $1`, id)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "删除失败")
		return
	}
	if result.RowsAffected() == 0 {
		apiError(c, http.StatusNotFound, "ARTICLE_NOT_FOUND", "文章不存在")
		return
	}

	c.Status(http.StatusNoContent)
}
