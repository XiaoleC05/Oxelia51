package proxykey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"

	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	repo *Repository
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{repo: NewRepository(pool)}
}

// 生成密钥：ox_<项目前缀>_<16 字节随机 hex>；DB 存 sha256 hex，明文仅返回一次。
func generateKey(projectID string) (raw, prefix, hash string) {
	prefix = "ox_" + shortProjectPrefix(projectID) + "_"
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	raw = prefix + hex.EncodeToString(buf)
	h := sha256.Sum256([]byte(raw))
	return raw, prefix, hex.EncodeToString(h[:])
}

func shortProjectPrefix(id string) string {
	s := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return -1
	}, id)
	if len(s) > 8 {
		s = s[:8]
	}
	if s == "" {
		s = "proj"
	}
	return s
}

// Create POST /api/admin/proxy-keys {project_id} → 返回明文 key（仅一次）
func (h *Handler) Create(c *gin.Context) {
	var req struct {
		ProjectID string `json:"project_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "缺少 project_id")
		return
	}
	raw, prefix, hash := generateKey(req.ProjectID)
	k, err := h.repo.Create(c.Request.Context(), req.ProjectID, hash, prefix)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "CREATE_FAILED", "密钥创建失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":        k.ID,
		"projectId": k.ProjectID,
		"key":       raw,
		"keyPrefix": k.KeyPrefix,
		"createdAt": k.CreatedAt,
	})
}

// List GET /api/admin/proxy-keys?project_id=
func (h *Handler) List(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "缺少 project_id")
		return
	}
	keys, err := h.repo.List(c.Request.Context(), projectID)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "LIST_FAILED", "密钥列表获取失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": keys})
}

// Delete DELETE /api/admin/proxy-keys/:id（软删除 enabled=false）
func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "无效 id")
		return
	}
	n, err := h.repo.Disable(c.Request.Context(), id)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "DELETE_FAILED", "密钥删除失败")
		return
	}
	if n == 0 {
		infra.ApiError(c, http.StatusNotFound, "NOT_FOUND", "密钥不存在或已禁用")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
