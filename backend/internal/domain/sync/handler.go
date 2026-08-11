package sync

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SyncHandler 跨设备同步接口（P4）。JWT 鉴权，按用户隔离。
// 桌面端通过 /api/auth/login 拿 JWT，upload/download 本地 token 事件。
type SyncHandler struct {
	repo *Repository
}

func NewHandler(pool *pgxpool.Pool) *SyncHandler {
	return &SyncHandler{repo: NewRepository(pool)}
}

// maxUploadEvents 单次上传事件数上限。
// 安全：当前主路径是 web 侧 /api/sync/upload（zod max(SYNC_PAGE_SIZE)=2000 已限），
// 本 Go 接口为遗留路径，此前无上限且 nginx /api/ 放行 500MB body，
// 超大 events 数组会撑爆内存（DoS 面），这里补上同样的防御上限。
const maxUploadEvents = 2000

// Upload 上传本地 token 事件（幂等：按 event_id 去重）。
// body: {"deviceId":"...", "events":[{eventId, projectId, sessionId, provider, model, promptTokens, completionTokens, totalTokens, durationMs, ts}]}
func (h *SyncHandler) Upload(c *gin.Context) {
	userID := c.GetInt64("userID")
	if userID == 0 {
		infra.ApiError(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}

	var req struct {
		DeviceID string      `json:"deviceId"`
		Events   []SyncEvent `json:"events"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.DeviceID == "" {
		infra.ApiError(c, http.StatusBadRequest, "BAD_REQUEST", "参数错误")
		return
	}
	if len(req.Events) > maxUploadEvents {
		infra.ApiError(c, http.StatusBadRequest, "BAD_REQUEST", "单次上传事件数超过上限")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	if err := h.repo.EnsureTable(ctx); err != nil {
		slog.Error("sync ensure table failed", "error", err)
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL", "同步失败")
		return
	}
	inserted, err := h.repo.InsertEvents(ctx, userID, req.Events)
	if err != nil {
		slog.Error("sync insert failed", "error", err)
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL", "同步失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "inserted": inserted})
}

// Download 增量下载他人设备的事件（按用户 + after 游标，排除本设备）。
// GET /api/sync/download?after=<RFC3339>&deviceId=<id>
func (h *SyncHandler) Download(c *gin.Context) {
	userID := c.GetInt64("userID")
	if userID == 0 {
		infra.ApiError(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}
	afterStr := c.Query("after")
	deviceID := c.Query("deviceId")
	if afterStr == "" {
		infra.ApiError(c, http.StatusBadRequest, "BAD_REQUEST", "缺少 after 参数")
		return
	}
	after, err := time.Parse(time.RFC3339, afterStr)
	if err != nil {
		infra.ApiError(c, http.StatusBadRequest, "BAD_REQUEST", "after 格式错误")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	events, err := h.repo.ListEventsAfter(ctx, userID, after, deviceID, 2000)
	if err != nil {
		slog.Error("sync download failed", "error", err)
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL", "同步失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "events": events})
}
