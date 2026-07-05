package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ArticleHandler 文章 + 页面
type ArticleHandler struct {
	db *pgxpool.Pool
}

func NewArticleHandler(db *pgxpool.Pool) *ArticleHandler {
	return &ArticleHandler{db: db}
}

// scanArticleListItem 从 rows 扫描为列表项
func scanArticleListItem(rows pgx.Rows, item *model.ArticleListItem) error {
	return rows.Scan(
		&item.ID, &item.Title, &item.Summary, &item.Category,
		&item.Tags, &item.PublishedAt, &item.DisplayOrder,
	)
}

// ListPublic GET /api/articles — 公开列表（非草稿 + enabled，轻量不含正文）
func (h *ArticleHandler) ListPublic(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	category := c.Query("category")

	query := `
		SELECT id, title, summary, category, tags, published_at, display_order
		FROM articles
		WHERE enabled = TRUE AND is_draft = FALSE`
	args := []interface{}{}
	if category != "" {
		query += ` AND category = $1`
		args = append(args, category)
	}
	query += ` ORDER BY display_order, published_at DESC NULLS LAST, id`

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.ArticleListItem{}
	for rows.Next() {
		var item model.ArticleListItem
		if err := scanArticleListItem(rows, &item); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// GetPublic GET /api/articles/:id — 公开详情（含正文）
func (h *ArticleHandler) GetPublic(c *gin.Context) {
	id := c.Param("id")
	// L2: 整数校验，防止非数字输入
	var idInt int64
	if _, err := fmt.Sscanf(id, "%d", &idInt); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_ID", "文章 ID 无效")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.Article
	err := h.db.QueryRow(ctx, `
		SELECT id, title, url, summary, content, category, tags, is_draft,
		       published_at, display_order, enabled, created_at, updated_at
		FROM articles
		WHERE id = $1 AND enabled = TRUE AND is_draft = FALSE`, id,
	).Scan(
		&item.ID, &item.Title, &item.URL, &item.Summary, &item.Content,
		&item.Category, &item.Tags, &item.IsDraft,
		&item.PublishedAt, &item.DisplayOrder, &item.Enabled,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "ARTICLE_NOT_FOUND", "文章不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	c.JSON(http.StatusOK, item)
}

// Categories GET /api/articles/categories — 公开分类列表
func (h *ArticleHandler) Categories(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT DISTINCT category, COUNT(*) as cnt
		FROM articles
		WHERE enabled = TRUE AND is_draft = FALSE AND category != ''
		GROUP BY category
		ORDER BY category`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	type CategoryCount struct {
		Category string `json:"category"`
		Count    int    `json:"count"`
	}
	categories := []CategoryCount{}
	for rows.Next() {
		var cc CategoryCount
		if err := rows.Scan(&cc.Category, &cc.Count); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取失败")
			return
		}
		categories = append(categories, cc)
	}

	c.JSON(http.StatusOK, categories)
}

// ListAdmin GET /api/admin/articles — 管理端列表（全部，含草稿）
func (h *ArticleHandler) ListAdmin(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, title, url, summary, content, category, tags, is_draft,
		       published_at, display_order, enabled, created_at, updated_at
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
			&item.ID, &item.Title, &item.URL, &item.Summary, &item.Content,
			&item.Category, &item.Tags, &item.IsDraft,
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
	if req.URL != "" && (len(req.URL) < 8 || req.URL[:4] != "http") {
		apiError(c, http.StatusBadRequest, "INVALID_URL", "URL 格式无效，需以 http 开头")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.Article
	err := h.db.QueryRow(ctx, `
		INSERT INTO articles (title, url, summary, content, category, tags, is_draft, published_at, display_order, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
		RETURNING id, title, url, summary, content, category, tags, is_draft,
		          published_at, display_order, enabled, created_at, updated_at`,
		req.Title, req.URL, req.Summary, req.Content, req.Category, req.Tags,
		req.IsDraft, req.PublishedAt, req.DisplayOrder,
	).Scan(
		&item.ID, &item.Title, &item.URL, &item.Summary, &item.Content,
		&item.Category, &item.Tags, &item.IsDraft,
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
	// L1: URL 格式校验（与 Create 一致）
	if req.URL != nil && *req.URL != "" && (len(*req.URL) < 8 || (*req.URL)[:4] != "http") {
		apiError(c, http.StatusBadRequest, "INVALID_URL", "URL 格式无效，需以 http 开头")
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
			content = COALESCE($5, content),
			category = COALESCE($6, category),
			tags = COALESCE($7, tags),
			is_draft = COALESCE($8, is_draft),
			published_at = COALESCE($9, published_at),
			display_order = COALESCE($10, display_order),
			enabled = COALESCE($11, enabled),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, title, url, summary, content, category, tags, is_draft,
		          published_at, display_order, enabled, created_at, updated_at`,
		id, req.Title, req.URL, req.Summary, req.Content, req.Category,
		req.Tags, req.IsDraft, req.PublishedAt, req.DisplayOrder, req.Enabled,
	).Scan(
		&item.ID, &item.Title, &item.URL, &item.Summary, &item.Content,
		&item.Category, &item.Tags, &item.IsDraft,
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

// ===== 静态页面 =====

// GetPage GET /api/pages/:slug — 公开页面内容
func (h *ArticleHandler) GetPage(c *gin.Context) {
	slug := c.Param("slug")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var page model.Page
	err := h.db.QueryRow(ctx, `
		SELECT id, slug, title, content, enabled, created_at, updated_at
		FROM pages
		WHERE slug = $1 AND enabled = TRUE`, slug,
	).Scan(
		&page.ID, &page.Slug, &page.Title, &page.Content,
		&page.Enabled, &page.CreatedAt, &page.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "PAGE_NOT_FOUND", "页面不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	c.JSON(http.StatusOK, page)
}

// ListPagesAdmin GET /api/admin/pages — 管理端页面列表
func (h *ArticleHandler) ListPagesAdmin(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, slug, title, content, enabled, created_at, updated_at
		FROM pages
		ORDER BY slug`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.Page{}
	for rows.Next() {
		var page model.Page
		if err := rows.Scan(
			&page.ID, &page.Slug, &page.Title, &page.Content,
			&page.Enabled, &page.CreatedAt, &page.UpdatedAt,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取失败")
			return
		}
		items = append(items, page)
	}

	c.JSON(http.StatusOK, items)
}

// UpdatePage PUT /api/admin/pages/:slug
func (h *ArticleHandler) UpdatePage(c *gin.Context) {
	slug := c.Param("slug")

	var req model.UpdatePageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var page model.Page
	err := h.db.QueryRow(ctx, `
		UPDATE pages SET
			title = COALESCE($2, title),
			content = COALESCE($3, content),
			enabled = COALESCE($4, enabled),
			updated_at = NOW()
		WHERE slug = $1
		RETURNING id, slug, title, content, enabled, created_at, updated_at`,
		slug, req.Title, req.Content, req.Enabled,
	).Scan(
		&page.ID, &page.Slug, &page.Title, &page.Content,
		&page.Enabled, &page.CreatedAt, &page.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "PAGE_NOT_FOUND", "页面不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, page)
}
