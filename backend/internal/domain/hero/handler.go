package hero

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HeroHandler 文件上传（通用图片上传端点）
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
