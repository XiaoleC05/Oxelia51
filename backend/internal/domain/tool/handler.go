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

type AdminToolHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewAdminToolHandler(db *pgxpool.Pool, cfg *config.Config) *AdminToolHandler {
	return &AdminToolHandler{db: db, cfg: cfg}
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
	TotalUsers    int `json:"total_users"`
	TotalTools    int `json:"total_tools"`
	NewUsers7d    int `json:"new_users_7d"`
	NewUsers30d   int `json:"new_users_30d"`
	NewUsersSince int `json:"new_users_since"`
}

func (h *AdminToolHandler) DashboardStats(c *gin.Context) {
	ctx := c.Request.Context()
	since := c.Query("since")

	var resp dashboardStatsResponse

	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&resp.TotalUsers)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM tools`).Scan(&resp.TotalTools)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`).Scan(&resp.NewUsers7d)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'`).Scan(&resp.NewUsers30d)

	if since != "" {
		h.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= $1`, since).Scan(&resp.NewUsersSince)
	}

	c.JSON(http.StatusOK, resp)
}
