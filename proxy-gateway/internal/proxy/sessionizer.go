package proxy

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Sessionizer 按客户端指纹 + 空闲窗口推断会话（#6）。
//
// 问题：Claude Code / Cursor 不会发送 X-Session-ID，原实现每次请求生成新 uuid，
// 导致「会话」屏一条一行，聚合（模型数/次数）永远显示 1。
//
// 启发式：同一 User-Agent + RemoteAddr 在 idleTTL 内连续请求视为同一会话；
// 超过 idleTTL 无活动则开新会话。客户端显式 X-Session-ID 优先（不经过本推断）。
//
// 局限：同一机器并行跑两个同类型客户端（如两个 Claude Code）会合并到一个会话。
// 对个人本地记账本可接受；需要精确区分时由客户端发 X-Session-ID。
type Sessionizer struct {
	mu       sync.Mutex
	sessions map[string]sessionEntry
	idleTTL  time.Duration
}

type sessionEntry struct {
	id       string
	lastSeen time.Time
}

// NewSessionizer 创建会话推断器，idleTTL 为会话空闲超时（默认 30 分钟）。
func NewSessionizer(idleTTL time.Duration) *Sessionizer {
	if idleTTL <= 0 {
		idleTTL = 30 * time.Minute
	}
	return &Sessionizer{
		sessions: make(map[string]sessionEntry),
		idleTTL:  idleTTL,
	}
}

// Get 返回指纹对应的会话 ID；超过空闲窗口或首次见则新建。
func (s *Sessionizer) Get(fingerprint string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	if e, ok := s.sessions[fingerprint]; ok && now.Sub(e.lastSeen) < s.idleTTL {
		e.lastSeen = now
		s.sessions[fingerprint] = e
		return e.id
	}
	id := uuid.NewString()
	s.sessions[fingerprint] = sessionEntry{id: id, lastSeen: now}

	// 惰性清理：表过大时清掉超时 2× 的陈旧条目
	if len(s.sessions) > 512 {
		cutoff := now.Add(-2 * s.idleTTL)
		for k, e := range s.sessions {
			if e.lastSeen.Before(cutoff) {
				delete(s.sessions, k)
			}
		}
	}
	return id
}

// sessionFingerprint 客户端指纹：User-Agent + 连接 IP（不含临时源端口）。
// 本地模式下 IP 多为 127.0.0.1，UA 区分 Claude Code / Cursor 等。
// 注意：必须剥离 RemoteAddr 的端口（每次连接的临时端口不同，否则指纹每请求唯一）。
func sessionFingerprint(r *http.Request) string {
	ua := strings.TrimSpace(r.Header.Get("User-Agent"))
	if ua == "" {
		ua = "unknown"
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return ua + "|" + host
}

// InferAgent 根据 User-Agent 推断客户端工具（Agent = 用户使用的软件，LLM + harness）。
// 精确识别由客户端头 X-Oxelia51-Agent 覆盖（forward.go 优先读头）；推断失败归 "其他"。
func InferAgent(ua string) string {
	lower := strings.ToLower(strings.TrimSpace(ua))
	switch {
	case strings.Contains(lower, "claude-code"),
		strings.Contains(lower, "claude-cli"),
		strings.Contains(lower, "anthropic-cli"):
		return "claude-code"
	case strings.Contains(lower, "codex"):
		return "codex"
	case strings.Contains(lower, "cursor"):
		return "cursor"
	case strings.Contains(lower, "trae"):
		return "trae"
	case strings.Contains(lower, "qoder"):
		return "qoder"
	case strings.Contains(lower, "hermes"):
		return "hermes"
	case strings.Contains(lower, "windsurf"):
		return "windsurf"
	case strings.Contains(lower, "cc-switch"), strings.Contains(lower, "ccswitch"):
		return "cc-switch"
	case strings.Contains(lower, "ccv"):
		return "ccv"
	case strings.Contains(lower, "chatgpt"), strings.Contains(lower, "openai"):
		return "openai"
	default:
		return "其他"
	}
}
