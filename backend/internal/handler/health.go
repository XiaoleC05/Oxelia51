package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthHandler struct {
	db *pgxpool.Pool
}

func NewHealthHandler(db *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Health(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	dbOK := true
	if err := h.db.Ping(ctx); err != nil {
		dbOK = false
	}

	status := http.StatusOK
	if !dbOK {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"status":    map[bool]string{true: "ok", false: "degraded"}[dbOK],
		"database":  dbOK,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *HealthHandler) Uptime(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	var launchedAt time.Time
	err := h.db.QueryRow(ctx, `SELECT launched_at FROM site_settings WHERE id = 1`).Scan(&launchedAt)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"days": 0, "hours": 0})
		return
	}

	d := time.Since(launchedAt)
	c.JSON(http.StatusOK, gin.H{
		"launched_at": launchedAt.Format(time.RFC3339),
		"days":        int(d.Hours()) / 24,
		"hours":       int(d.Hours()) % 24,
	})
}
