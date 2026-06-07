package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ToolHandler 工具管理接口处理器
type ToolHandler struct {
	db *pgxpool.Pool
}

// NewToolHandler 创建工具处理器
func NewToolHandler(db *pgxpool.Pool) *ToolHandler {
	return &ToolHandler{db: db}
}

// List 工具列表 GET /api/tools
func (h *ToolHandler) List(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Query(ctx,
		`SELECT id, name, description, status, created_at, updated_at
		 FROM tools ORDER BY id`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	tools := []model.Tool{}
	for rows.Next() {
		var t model.Tool
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "读取数据失败"})
			return
		}
		tools = append(tools, t)
	}

	c.JSON(http.StatusOK, tools)
}

// Get 获取单个工具 GET /api/tools/:id
func (h *ToolHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var t model.Tool
	err = h.db.QueryRow(ctx,
		`SELECT id, name, description, status, created_at, updated_at
		 FROM tools WHERE id = $1`, id,
	).Scan(&t.ID, &t.Name, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "工具不存在"})
		return
	}

	c.JSON(http.StatusOK, t)
}

// Create 创建工具 POST /api/tools
func (h *ToolHandler) Create(c *gin.Context) {
	var req model.CreateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	// 默认状态为 enabled
	if req.Status == "" {
		req.Status = "enabled"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var t model.Tool
	err := h.db.QueryRow(ctx,
		`INSERT INTO tools (name, description, status)
		 VALUES ($1, $2, $3)
		 RETURNING id, name, description, status, created_at, updated_at`,
		req.Name, req.Description, req.Status,
	).Scan(&t.ID, &t.Name, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "工具名称已存在"})
		return
	}

	c.JSON(http.StatusCreated, t)
}

// Update 更新工具 PUT /api/tools/:id
func (h *ToolHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req model.UpdateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var t model.Tool
	err = h.db.QueryRow(ctx,
		`UPDATE tools
		 SET name = COALESCE(NULLIF($1, ''), name),
		     description = COALESCE($2, description),
		     status = COALESCE(NULLIF($3, ''), status),
		     updated_at = NOW()
		 WHERE id = $4
		 RETURNING id, name, description, status, created_at, updated_at`,
		req.Name, req.Description, req.Status, id,
	).Scan(&t.ID, &t.Name, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "工具不存在"})
		return
	}

	c.JSON(http.StatusOK, t)
}

// Delete 删除工具 DELETE /api/tools/:id
func (h *ToolHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	tag, err := h.db.Exec(ctx, `DELETE FROM tools WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}

	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "工具不存在"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
