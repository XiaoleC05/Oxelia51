package admin

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/gin-gonic/gin"
)

type StatsHandler struct {
	mu      sync.Mutex
	prevCPU *cpuSample
	hc      *http.Client
}

func NewStatsHandler() *StatsHandler {
	return &StatsHandler{
		hc: &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *StatsHandler) ServerStats(c *gin.Context) {
	var resp serverStatsResponse

	if runtime.GOOS == "linux" {
		resp.CPUPercent = h.cpuPercent()
		resp.MemoryUsedMB, resp.MemoryTotalMB = memInfoLinux()
		resp.DiskUsedPercent, resp.DiskTotalGB = diskUsageLinux("/")
		resp.UptimeSeconds = uptimeLinux()
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	resp.GoGoroutines = runtime.NumGoroutine()
	resp.GoAllocMB = m.Alloc / 1024 / 1024

	if url := os.Getenv("TENCENT_HEALTH_URL"); url != "" {
		if remote, err := h.fetchRemoteStats(url); err == nil {
			resp.Remote = remote
		}
	}

	c.JSON(http.StatusOK, resp)
}

func (h *StatsHandler) fetchRemoteStats(rawURL string) (*serverStats, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("unsupported scheme: %s", parsed.Scheme)
	}
	if parsed.Hostname() != "118.25.138.177" && parsed.Hostname() != "127.0.0.1" && parsed.Hostname() != "localhost" {
		return nil, fmt.Errorf("untrusted host: %s", parsed.Hostname())
	}

	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := h.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil
	}

	var remote serverStats
	if err := json.NewDecoder(resp.Body).Decode(&remote); err != nil {
		return nil, err
	}
	return &remote, nil
}

func (h *StatsHandler) cpuPercent() float64 {
	cur, err := readCPUStat()
	if err != nil {
		return 0
	}

	h.mu.Lock()
	prev := h.prevCPU
	h.prevCPU = cur
	h.mu.Unlock()

	if prev == nil {
		return 0
	}

	totalDelta := float64(cur.total() - prev.total())
	if totalDelta == 0 {
		return 0
	}
	idleDelta := float64(cur.idleTotal() - prev.idleTotal())
	return (1.0 - idleDelta/totalDelta) * 100.0
}

func readCPUStat() (*cpuSample, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 9 {
			return nil, nil
		}
		vals := make([]uint64, 8)
		for i := 0; i < 8; i++ {
			v, err := strconv.ParseUint(fields[i+1], 10, 64)
			if err != nil {
				return nil, err
			}
			vals[i] = v
		}
		return &cpuSample{
			user: vals[0], nice: vals[1], system: vals[2], idle: vals[3],
			iowait: vals[4], irq: vals[5], softirq: vals[6], steal: vals[7],
		}, nil
	}
	return nil, scanner.Err()
}

func memInfoLinux() (usedMB, totalMB uint64) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	defer f.Close()

	var total, available uint64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "MemTotal:"):
			total = parseMeminfoKB(line)
		case strings.HasPrefix(line, "MemAvailable:"):
			available = parseMeminfoKB(line)
		}
	}
	totalMB = total / 1024
	if total > available {
		usedMB = (total - available) / 1024
	}
	return
}

func parseMeminfoKB(line string) uint64 {
	fields := strings.Fields(line)
	if len(fields) >= 2 {
		v, _ := strconv.ParseUint(fields[1], 10, 64)
		return v
	}
	return 0
}

func syscallStatfs(path string, stat unsafe.Pointer) error {
	pathBytes := append([]byte(path), 0)
	_, _, errno := rawSyscallStatfs(
		uintptr(unsafe.Pointer(&pathBytes[0])),
		uintptr(stat),
	)
	if errno != 0 {
		return errno
	}
	return nil
}

func diskUsageLinux(path string) (usedPercent float64, totalGB uint64) {
	var stat statfs_t
	if err := syscallStatfs(path, unsafe.Pointer(&stat)); err != nil {
		return 0, 0
	}
	totalBytes := stat.Blocks * uint64(stat.Bsize)
	freeBytes := stat.Bfree * uint64(stat.Bsize)
	totalGB = totalBytes / (1024 * 1024 * 1024)
	if totalBytes > 0 {
		usedPercent = float64(totalBytes-freeBytes) / float64(totalBytes) * 100.0
	}
	return
}

func uptimeLinux() uint64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0
	}
	f, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0
	}
	return uint64(f)
}

// --- IP 白名单管理 ---

// WhitelistHandler IP 白名单 CRUD 接口
type WhitelistHandler struct {
	repo *WhitelistRepository
}

func NewWhitelistHandler(repo *WhitelistRepository) *WhitelistHandler {
	return &WhitelistHandler{repo: repo}
}

// ListWhitelist GET /api/admin/ip-whitelist
func (h *WhitelistHandler) ListWhitelist(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	items, err := h.repo.List(ctx)
	if err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询失败")
		return
	}

	c.JSON(http.StatusOK, items)
}

// CreateWhitelist POST /api/admin/ip-whitelist
func (h *WhitelistHandler) CreateWhitelist(c *gin.Context) {
	var req struct {
		IP    string `json:"ip" binding:"required"`
		Label string `json:"label"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_REQUEST", "请求格式错误: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.repo.Create(ctx, req.IP, req.Label); err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "添加失败")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "created"})
}

// DeleteWhitelist DELETE /api/admin/ip-whitelist/:id
func (h *WhitelistHandler) DeleteWhitelist(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		infra.ApiError(c, http.StatusBadRequest, "INVALID_ID", "ID 无效")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.repo.Delete(ctx, id); err != nil {
		infra.ApiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "删除失败")
		return
	}

	c.Status(http.StatusNoContent)
}
