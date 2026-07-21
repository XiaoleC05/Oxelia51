package gateway

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/XiaoleC05/oxelia51-backend/config"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errResponseTooLarge = errors.New("upstream response too large")

const (
	defaultUpstreamTimeout = 30 * time.Second
	defaultMaxBodyBytes    = 10 << 20 // 10MB
)

// Handler API 网关：/api/tools/:slug/proxy/*path
type Handler struct {
	db     *pgxpool.Pool
	cfg    *config.Config
	client *http.Client
}

func NewHandler(db *pgxpool.Pool, cfg *config.Config) *Handler {
	timeout := cfg.GatewayUpstreamTimeout
	if timeout <= 0 {
		timeout = defaultUpstreamTimeout
	}
	return &Handler{
		db:  db,
		cfg: cfg,
		client: &http.Client{
			Timeout: timeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

func (h *Handler) upstreamTimeout() time.Duration {
	if h.cfg.GatewayUpstreamTimeout > 0 {
		return h.cfg.GatewayUpstreamTimeout
	}
	return defaultUpstreamTimeout
}

func (h *Handler) Proxy(c *gin.Context) {
	slug := c.Param("slug")
	proxyPath := c.Param("path")
	if proxyPath == "" {
		proxyPath = "/"
	} else if !strings.HasPrefix(proxyPath, "/") {
		proxyPath = "/" + proxyPath
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.upstreamTimeout())
	defer cancel()

	tool, err := h.loadTool(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(c, http.StatusNotFound, "TOOL_NOT_FOUND", "工具不存在")
			return
		}
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "查询工具失败")
		return
	}

	role, _ := c.Get("userRole")
	roleStr, _ := role.(string)
	if err := CheckAccess(roleStr, tool.UserAccessible, tool.OnlineCapable, tool.Status); err != nil {
		var ae *AccessError
		if errors.As(err, &ae) {
			apiError(c, ae.Status, ae.Code, ae.Msg)
			return
		}
		apiError(c, http.StatusForbidden, "FORBIDDEN", err.Error())
		return
	}

	base := ResolveInternalAPIBase(slug, tool.InternalAPIBase)
	if base == "" {
		apiError(c, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "工具上游地址未配置")
		return
	}
	if !strings.HasPrefix(base, "http://127.0.0.1:") && !strings.HasPrefix(base, "http://localhost:") {
		apiError(c, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "上游地址配置无效")
		return
	}

	target, err := url.Parse(base + proxyPath)
	if err != nil {
		apiError(c, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "上游地址无效")
		return
	}
	if target.RawQuery == "" && c.Request.URL.RawQuery != "" {
		target.RawQuery = c.Request.URL.RawQuery
	}

	maxBody := h.cfg.GatewayMaxBodyBytes
	if maxBody <= 0 {
		maxBody = defaultMaxBodyBytes
	}
	body := c.Request.Body
	if body != nil {
		body = http.MaxBytesReader(c.Writer, body, maxBody)
	}

	upReq, err := http.NewRequestWithContext(ctx, c.Request.Method, target.String(), body)
	if err != nil {
		apiError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "构建上游请求失败")
		return
	}

	copyHeaders(upReq.Header, c.Request.Header)
	if err := injectGatewayHeaders(upReq, c, h.cfg); err != nil {
		// 未登录用户不注入身份头，直接转发（工具自行处理匿名访问）
	}

	resp, err := h.client.Do(upReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			apiError(c, http.StatusGatewayTimeout, "UPSTREAM_TIMEOUT", "上游响应超时")
			return
		}
		apiError(c, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "上游不可达")
		return
	}
	defer resp.Body.Close()

	maxResp := h.cfg.GatewayMaxBodyBytes
	if maxResp <= 0 {
		maxResp = defaultMaxBodyBytes
	}
	respBody, err := readLimitedBody(resp.Body, maxResp)
	if err != nil {
		if errors.Is(err, errResponseTooLarge) {
			apiError(c, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "上游响应体过大")
			return
		}
		apiError(c, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "读取上游响应失败")
		return
	}

	copyResponseHeaders(c.Writer.Header(), resp.Header)
	c.Status(resp.StatusCode)
	if _, err := c.Writer.Write(respBody); err != nil {
		fmt.Printf("gateway write response: %v\n", err)
	}
}

type toolRow struct {
	UserAccessible  bool
	OnlineCapable   bool
	Status          string
	InternalAPIBase string
}

func (h *Handler) loadTool(ctx context.Context, slug string) (*toolRow, error) {
	var t toolRow
	err := h.db.QueryRow(ctx, `
		SELECT user_accessible, online_capable, status, internal_api_base
		FROM tools WHERE slug = $1`, slug,
	).Scan(&t.UserAccessible, &t.OnlineCapable, &t.Status, &t.InternalAPIBase)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func readLimitedBody(r io.Reader, max int64) ([]byte, error) {
	limited := io.LimitReader(r, max+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > max {
		return nil, errResponseTooLarge
	}
	return data, nil
}

// clientIPForwardHeaders 是反向代理常用于传递客户端真实 IP 的请求头。
// Oxelia51 作为内网网关代理到上游工具时必须剥离这些头：
//   - 上游工具（如 DormGuard）的 loopback 信任校验基于 TCP peer 地址，
//     若上游启用 proxy-headers 解析，这些头会覆盖 TCP peer，导致信任校验失败。
//   - 这些头携带的是公网客户端 IP，对内网上游无业务意义，透传属于信息泄漏。
//   - Oxelia51 入站不清洗 X-Forwarded-For，前端可伪造，透传会污染上游 IP 逻辑。
var clientIPForwardHeaders = map[string]struct{}{
	"x-real-ip":                {},
	"x-forwarded-for":          {},
	"x-forwarded-host":         {},
	"x-forwarded-proto":        {},
	"x-forwarded-port":         {},
	"x-forwarded-server":       {},
	"x-client-ip":              {},
	"x-original-forwarded-for": {},
	"forwarded":                {}, // RFC 7239
}

func isClientIPForwardHeader(h string) bool {
	_, ok := clientIPForwardHeaders[strings.ToLower(h)]
	return ok
}

func copyHeaders(dst, src http.Header) {
	for k, vals := range src {
		if isHopByHop(k) || isClientIPForwardHeader(k) || strings.EqualFold(k, "Authorization") {
			continue
		}
		for _, v := range vals {
			dst.Add(k, v)
		}
	}
}

func copyResponseHeaders(dst, src http.Header) {
	for k, vals := range src {
		if isHopByHop(k) {
			continue
		}
		for _, v := range vals {
			dst.Add(k, v)
		}
	}
}

func injectGatewayHeaders(req *http.Request, c *gin.Context, cfg *config.Config) error {
	userID, _ := c.Get("userID")
	username, _ := c.Get("username")
	role, _ := c.Get("userRole")

	uid := strings.TrimSpace(fmt.Sprintf("%v", userID))
	uname := strings.TrimSpace(fmt.Sprintf("%v", username))
	r := strings.TrimSpace(fmt.Sprintf("%v", role))
	if uid == "" || uid == "0" || uid == "<nil>" {
		return fmt.Errorf("令牌缺少用户信息，请重新登录")
	}
	if uname == "" || uname == "<nil>" {
		return fmt.Errorf("令牌缺少用户名，请重新登录")
	}
	if r != "admin" && r != "user" {
		return fmt.Errorf("令牌角色无效，请重新登录")
	}

	req.Header.Set("X-Oxelia51-User-Id", uid)
	req.Header.Set("X-Oxelia51-Username", uname)
	req.Header.Set("X-Oxelia51-Role", r)
	req.Header.Set("X-Oxelia51-Request-Id", uuid.NewString())

	req.Header.Set("X-User-Id", uid)
	req.Header.Set("X-Username", uname)
	req.Header.Set("X-Role", r)

	// HMAC-SHA256 signature for gateway authentication
	if cfg.GatewayHMACSecret != "" {
		ts := strconv.FormatInt(time.Now().Unix(), 10)
		mac := hmac.New(sha256.New, []byte(cfg.GatewayHMACSecret))
		mac.Write([]byte(ts + uid + cfg.GatewayHMACSecret))
		sig := hex.EncodeToString(mac.Sum(nil))
		req.Header.Set("X-Gateway-Timestamp", ts)
		req.Header.Set("X-Gateway-Signature", sig)
	}

	return nil
}

func isHopByHop(h string) bool {
	switch strings.ToLower(h) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
		"te", "trailers", "transfer-encoding", "upgrade", "host":
		return true
	default:
		return false
	}
}

func apiError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": message, "code": code})
}
