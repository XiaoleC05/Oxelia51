package tool

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/user"
	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ToolHandler struct {
	db *pgxpool.Pool
}

func NewToolHandler(db *pgxpool.Pool) *ToolHandler {
	return &ToolHandler{db: db}
}

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
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []ToolListItem{}
	for rows.Next() {
		var item ToolListItem
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.UserAccessible, &item.Status, &item.ReleaseURL, &item.OnlineCapable,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		item.Badge = ComputeBadge(item.Status, item.UserAccessible)
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

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
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []PortfolioItem{}
	for rows.Next() {
		var item PortfolioItem
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.GithubRepo, &item.SourceDir,
			&item.NameOverride, &item.DescriptionOverride, &item.LinkedToolSlug,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

func (h *ToolHandler) Get(c *gin.Context) {
	slug := c.Param("slug")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item ToolListItem
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
			infra.ApiError(c, http.StatusNotFound, "TOOL_NOT_FOUND", "工具不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	item.Badge = ComputeBadge(item.Status, item.UserAccessible)
	c.JSON(http.StatusOK, item)
}

type AdminToolHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewAdminToolHandler(db *pgxpool.Pool, cfg *config.Config) *AdminToolHandler {
	return &AdminToolHandler{db: db, cfg: cfg}
}

func (h *AdminToolHandler) PatchTool(c *gin.Context) {
	slug := c.Param("slug")

	var req PatchToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	if req.Status != nil && *req.Status != "enabled" && *req.Status != "disabled" {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_STATUS", "status 必须为 enabled 或 disabled")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var detail AdminToolDetail
	err := h.db.QueryRow(ctx, `
		UPDATE tools SET
			user_accessible = COALESCE($2, user_accessible),
			status = COALESCE($3, status),
			description_override = COALESCE(NULLIF($4, ''), description_override),
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
			infra.ApiError(c, http.StatusNotFound, "TOOL_NOT_FOUND", "工具不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, detail)
}

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
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []AdminToolDetail{}
	for rows.Next() {
		var item AdminToolDetail
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.UserAccessible, &item.OnlineCapable, &item.Status,
			&item.InternalAPIBase, &item.GithubRepo, &item.ReleaseURL,
			&item.ManifestPath, &item.DescriptionOverride,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

func (h *AdminToolHandler) ListUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	q := c.Query("q")

	var rows pgx.Rows
	var err error
	if q != "" {
		pattern := "%" + q + "%"
		rows, err = h.db.Query(ctx, `
			SELECT id, account_id, username, email, role, email_verified, created_at, updated_at
			FROM users
			WHERE account_id ILIKE $1 OR email ILIKE $1
			ORDER BY created_at DESC`, pattern)
	} else {
		rows, err = h.db.Query(ctx, `
			SELECT id, account_id, username, email, role, email_verified, created_at, updated_at
			FROM users
			ORDER BY created_at DESC`)
	}
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []user.AdminUserItem{}
	for rows.Next() {
		var item user.AdminUserItem
		if err := rows.Scan(
			&item.ID, &item.AccountID, &item.Username, &item.Email,
			&item.Role, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

func (h *AdminToolHandler) PatchUser(c *gin.Context) {
	id := c.Param("id")

	var req user.PatchUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	if req.Role != nil && *req.Role != "admin" && *req.Role != "user" {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_ROLE", "role 必须为 admin 或 user")
		return
	}

	currentUserID := c.GetInt64("userID")
	if req.Role != nil && *req.Role != "admin" {
		var targetID int64
		if _, err := fmt.Sscanf(id, "%d", &targetID); err == nil && targetID == currentUserID {
			infra.ApiError(c, http.StatusUnprocessableEntity, "CANNOT_DEMOTE_SELF", "不能将自己降级为普通用户")
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item user.AdminUserItem
	err := h.db.QueryRow(ctx, `
		UPDATE users SET
			email_verified = COALESCE($2, email_verified),
			role = COALESCE($3, role),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, account_id, username, email, role, email_verified, created_at, updated_at`,
		id, req.EmailVerified, req.Role,
	).Scan(
		&item.ID, &item.AccountID, &item.Username, &item.Email,
		&item.Role, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			infra.ApiError(c, http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}

func (h *AdminToolHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	var req user.DeleteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	expected := "DELETE " + req.AccountID
	if req.Confirm != expected {
		infra.ApiError(c, http.StatusBadRequest, "CONFIRM_MISMATCH",
			"确认文本不匹配，请输入 'DELETE "+req.AccountID+"' 以确认删除")
		return
	}

	currentUserID := c.GetInt64("userID")
	var targetID int64
	if _, err := fmt.Sscanf(id, "%d", &targetID); err == nil && targetID == currentUserID {
		infra.ApiError(c, http.StatusUnprocessableEntity, "CANNOT_DELETE_SELF", "不能删除自己的账户")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var dbAccountID string
	err := h.db.QueryRow(ctx, `SELECT account_id FROM users WHERE id = $1`, id).Scan(&dbAccountID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			infra.ApiError(c, http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	if dbAccountID != req.AccountID {
		infra.ApiError(c, http.StatusBadRequest, "ACCOUNT_ID_MISMATCH", "账号 ID 不匹配")
		return
	}

	_, _ = h.db.Exec(ctx, `DELETE FROM login_logs WHERE user_id = $1`, id)

	_, err = h.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "删除失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user_deleted"})
}

type dashboardStatsResponse struct {
	TotalUsers     int `json:"total_users"`
	TotalTools     int `json:"total_tools"`
	NewUsers7d     int `json:"new_users_7d"`
	NewUsers30d    int `json:"new_users_30d"`
	NewUsersSince  int `json:"new_users_since"`
	TotalArticles  int `json:"total_articles"`
	TotalPortfolio int `json:"total_portfolio"`
}

func (h *AdminToolHandler) DashboardStats(c *gin.Context) {
	ctx := c.Request.Context()
	since := c.Query("since")

	var resp dashboardStatsResponse

	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&resp.TotalUsers)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM tools`).Scan(&resp.TotalTools)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`).Scan(&resp.NewUsers7d)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'`).Scan(&resp.NewUsers30d)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM articles`).Scan(&resp.TotalArticles)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM portfolio_items`).Scan(&resp.TotalPortfolio)

	if since != "" {
		h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= $1`, since).Scan(&resp.NewUsersSince)
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AdminToolHandler) ScanLocal(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	result, err := ScanLocal(ctx, h.db, h.cfg.CodeRoot)
	if err != nil {
		if result != nil {
			c.JSON(http.StatusConflict, gin.H{
				"error":  err.Error(),
				"code":   "SCAN_FAILED",
				"result": result,
			})
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "SCAN_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, result)
}

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
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}
	defer rows.Close()

	items := []PortfolioItem{}
	for rows.Next() {
		var item PortfolioItem
		if err := rows.Scan(
			&item.Slug, &item.Name, &item.Description,
			&item.GithubRepo, &item.SourceDir,
			&item.NameOverride, &item.DescriptionOverride, &item.LinkedToolSlug,
		); err != nil {
			infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "读取数据失败")
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

func (h *AdminToolHandler) UpdatePortfolio(c *gin.Context) {
	slug := c.Param("slug")

	var req UpdatePortfolioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var item PortfolioItem
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
			infra.ApiError(c, http.StatusNotFound, "PORTFOLIO_NOT_FOUND", "作品集条目不存在")
			return
		}
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "更新失败")
		return
	}

	c.JSON(http.StatusOK, item)
}
