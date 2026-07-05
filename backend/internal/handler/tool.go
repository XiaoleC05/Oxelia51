package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/model"
	"github.com/XiaoleC05/oxelia51-backend/internal/registry"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ToolHandler 工具目录公开接口
type ToolHandler struct {
	db *pgxpool.Pool
}

func NewToolHandler(db *pgxpool.Pool) *ToolHandler {
	return &ToolHandler{db: db}
}

// List GET /api/tools — 全部 online_capable=true 的工具
func (h *ToolHandler) List(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT slug, name,
		       COALESCE(description_override, description) AS description,
		       user_accessible, status, release_url, online_capable
		FROM tools
		WHERE online_capable = TRUE
		ORDER BY name`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.ToolListItem{}
	for rows.Next() {
		var item model.ToolListItem
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.UserAccessible, &item.Status, &item.ReleaseURL, &item.OnlineCapable,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		item.Badge = registry.ComputeBadge(item.Status, item.UserAccessible)
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// ListPortfolioPublic GET /api/portfolio — 公开作品集列表
func (h *ToolHandler) ListPortfolioPublic(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT slug,
		       COALESCE(name_override, name) AS name,
		       COALESCE(description_override, description) AS description,
		       github_repo, source_dir, name_override, description_override, linked_tool_slug
		FROM portfolio_items
		ORDER BY name`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.PortfolioItem{}
	for rows.Next() {
		var item model.PortfolioItem
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.GithubRepo, &item.SourceDir,
			&item.NameOverride, &item.DescriptionOverride, &item.LinkedToolSlug,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// Get GET /api/tools/:slug
func (h *ToolHandler) Get(c *gin.Context) {
	slug := c.Param("slug")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.ToolListItem
	err := h.db.QueryRow(ctx, `
		SELECT slug, name,
		       COALESCE(description_override, description) AS description,
		       user_accessible, status, release_url, online_capable
		FROM tools
		WHERE slug = $1 AND online_capable = TRUE`, slug,
	).Scan(
		&item.Slug, &item.Name, &item.Description,
		&item.UserAccessible, &item.Status, &item.ReleaseURL, &item.OnlineCapable,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "TOOL_NOT_FOUND", "工具不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	item.Badge = registry.ComputeBadge(item.Status, item.UserAccessible)
	c.JSON(http.StatusOK, item)
}

// AdminToolHandler 管理端工具与作品集接口
type AdminToolHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewAdminToolHandler(db *pgxpool.Pool, cfg *config.Config) *AdminToolHandler {
	return &AdminToolHandler{db: db, cfg: cfg}
}

// PatchTool PATCH /api/admin/tools/:slug
func (h *AdminToolHandler) PatchTool(c *gin.Context) {
	slug := c.Param("slug")

	var req model.PatchToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	if req.Status != nil && *req.Status != "enabled" && *req.Status != "disabled" {
		apiError(c, http.StatusBadRequest, "INVALID_STATUS", "status 必须为 enabled 或 disabled")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var detail model.AdminToolDetail
	err := h.db.QueryRow(ctx, `
		UPDATE tools SET
			user_accessible = COALESCE($2, user_accessible),
			status = COALESCE($3, status),
			description_override = COALESCE($4, description_override),
			internal_api_base = COALESCE($5, internal_api_base),
			updated_at = NOW()
		WHERE slug = $1
		RETURNING slug, name, description, user_accessible, online_capable, status,
		          internal_api_base, github_repo, release_url, manifest_path, description_override`,
		slug, req.UserAccessible, req.Status, req.DescriptionOverride, req.InternalAPIBase,
	).Scan(
		&detail.Slug, &detail.Name, &detail.Description,
		&detail.UserAccessible, &detail.OnlineCapable, &detail.Status,
		&detail.InternalAPIBase, &detail.GithubRepo, &detail.ReleaseURL,
		&detail.ManifestPath, &detail.DescriptionOverride,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "TOOL_NOT_FOUND", "工具不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, detail)
}

// ListTools GET /api/admin/tools — 列出全部工具（含非在线），管理端用
func (h *AdminToolHandler) ListTools(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT slug, name, description,
		       user_accessible, online_capable, status,
		       internal_api_base, github_repo, release_url, manifest_path, description_override
		FROM tools
		ORDER BY name`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.AdminToolDetail{}
	for rows.Next() {
		var item model.AdminToolDetail
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.UserAccessible, &item.OnlineCapable, &item.Status,
			&item.InternalAPIBase, &item.GithubRepo, &item.ReleaseURL,
			&item.ManifestPath, &item.DescriptionOverride,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// ListUsers GET /api/admin/users — 列出全部用户
func (h *AdminToolHandler) ListUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT id, username, email, role, email_verified, created_at
		FROM users
		ORDER BY created_at DESC`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.AdminUserItem{}
	for rows.Next() {
		var item model.AdminUserItem
		if err := rows.Scan(
			&item.ID, &item.Username, &item.Email,
			&item.Role, &item.EmailVerified, &item.CreatedAt,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// PatchUser PATCH /api/admin/users/:id — 修改用户邮箱验证状态或角色
func (h *AdminToolHandler) PatchUser(c *gin.Context) {
	id := c.Param("id")

	var req model.PatchUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	if req.Role != nil && *req.Role != "admin" && *req.Role != "user" {
		apiError(c, http.StatusBadRequest, "INVALID_ROLE", "role 必须为 admin 或 user")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.AdminUserItem
	err := h.db.QueryRow(ctx, `
		UPDATE users SET
			email_verified = COALESCE($2, email_verified),
			role = COALESCE($3, role),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, username, email, role, email_verified, created_at`,
		id, req.EmailVerified, req.Role,
	).Scan(
		&item.ID, &item.Username, &item.Email,
		&item.Role, &item.EmailVerified, &item.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}

// ScanLocal POST /api/admin/tools/scan-local
func (h *AdminToolHandler) ScanLocal(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	result, err := registry.ScanLocal(ctx, h.db, h.cfg.CodeRoot)
	if err != nil {
		if result != nil {
			c.JSON(http.StatusConflict, gin.H{
				"error":  err.Error(),
				"code":   "SCAN_FAILED",
				"result": result,
			})
			return
		}
		apiError(c, http.StatusInternalServerError, "SCAN_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, result)
}

// ListPortfolio GET /api/admin/portfolio
func (h *AdminToolHandler) ListPortfolio(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx, `
		SELECT slug,
		       COALESCE(name_override, name) AS name,
		       COALESCE(description_override, description) AS description,
		       github_repo, source_dir, name_override, description_override, linked_tool_slug
		FROM portfolio_items
		ORDER BY name`)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []model.PortfolioItem{}
	for rows.Next() {
		var item model.PortfolioItem
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.GithubRepo, &item.SourceDir,
			&item.NameOverride, &item.DescriptionOverride, &item.LinkedToolSlug,
		); err != nil {
			apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// UpdatePortfolio PUT /api/admin/portfolio/:slug
func (h *AdminToolHandler) UpdatePortfolio(c *gin.Context) {
	slug := c.Param("slug")

	var req model.UpdatePortfolioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item model.PortfolioItem
	err := h.db.QueryRow(ctx, `
		UPDATE portfolio_items SET
			name_override = COALESCE($2, name_override),
			description_override = COALESCE($3, description_override)
		WHERE slug = $1
		RETURNING slug,
		          COALESCE(name_override, name),
		          COALESCE(description_override, description),
		          github_repo, source_dir, name_override, description_override, linked_tool_slug`,
		slug, req.NameOverride, req.DescriptionOverride,
	).Scan(
		&item.Slug, &item.Name, &item.Description,
		&item.GithubRepo, &item.SourceDir,
		&item.NameOverride, &item.DescriptionOverride, &item.LinkedToolSlug,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "PORTFOLIO_NOT_FOUND", "作品集条目不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}
