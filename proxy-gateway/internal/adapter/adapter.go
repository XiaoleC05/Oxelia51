package adapter

import (
	"io"
	"net/http"
	"time"
)

// TokenUsage 表示一次 LLM 调用的 token 用量
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	// Anthropic prompt caching（#4）：cache_creation 按计价 1.25×、cache_read 0.1×
	// 折算进 PromptTokens，使 costOf 无需改 schema 即可准确计成本。
	// OpenAI 系无此字段，保持 0。
	CacheCreationTokens int `json:"cache_creation_tokens"`
	CacheReadTokens     int `json:"cache_read_tokens"`
}

// TokenRecord 是写入 ClickHouse 的一行记录
type TokenRecord struct {
	EventID          string
	ProjectID        string
	SessionID        string
	Provider         string
	Model            string
	PromptTokens     uint32
	CompletionTokens uint32
	TotalTokens      uint32
	DurationMs       uint32
	Timestamp        time.Time
	APIKeyHash       string
	Partial          bool // #11: 客户端中断流式响应，usage 不完整
}

// Adapter 抽象不同 LLM 供应商的 token 用量提取逻辑
type Adapter interface {
	ProviderName() string
	ExtractUsage(resp *http.Response) (*TokenUsage, error)
	ExtractUsageFromStream(reader io.Reader) (*TokenUsage, error)
}

// Route 定义一条代理路由
type Route struct {
	Adapter    Adapter
	Target     string // 上游主机（含端口，如 api.openai.com:443）
	PathPrefix string // 上游路径前缀（如 /v1），无则为空
}
