package adapter

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// AnthropicAdapter 适配 Anthropic 协议（Anthropic / Gemini）
type AnthropicAdapter struct {
	name string
}

func NewAnthropicAdapter(name string) *AnthropicAdapter {
	return &AnthropicAdapter{name: name}
}

func (a *AnthropicAdapter) ProviderName() string { return a.name }

// ExtractUsage 从非流式 JSON 响应中提取 usage
func (a *AnthropicAdapter) ExtractUsage(resp *http.Response) (*TokenUsage, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Model string `json:"model"`
		Usage struct {
			InputTokens              int `json:"input_tokens"`
			OutputTokens             int `json:"output_tokens"`
			CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
			CacheReadInputTokens     int `json:"cache_read_input_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	return &TokenUsage{
		PromptTokens:        data.Usage.InputTokens,
		CompletionTokens:    data.Usage.OutputTokens,
		CacheCreationTokens: data.Usage.CacheCreationInputTokens,
		CacheReadTokens:     data.Usage.CacheReadInputTokens,
	}, nil
}

// ExtractUsageFromStream 从 SSE 流中提取 usage
// Anthropic SSE 格式：message_delta 事件包含 usage
func (a *AnthropicAdapter) ExtractUsageFromStream(reader io.Reader) (*TokenUsage, error) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	// 累积式解析（#4 + #15）：message_start 带 input + cache_*，message_delta 带 output。
	// 修复前用「整体覆盖」导致 input 丢失、cache 完全不记。
	var input, output, cacheCreate, cacheRead int
	seen := false

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")

		var data struct {
			Type  string `json:"type"`
			Usage *struct {
				InputTokens              int `json:"input_tokens"`
				OutputTokens             int `json:"output_tokens"`
				CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
				CacheReadInputTokens     int `json:"cache_read_input_tokens"`
			} `json:"usage"`
			Message *struct {
				Usage *struct {
					InputTokens              int `json:"input_tokens"`
					OutputTokens             int `json:"output_tokens"`
					CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
					CacheReadInputTokens     int `json:"cache_read_input_tokens"`
				} `json:"usage"`
			} `json:"message"`
		}
		if err := json.Unmarshal([]byte(payload), &data); err != nil {
			continue
		}
		// message_delta.usage 带 output_tokens（累积，取末值）
		if data.Usage != nil {
			seen = true
			if data.Usage.OutputTokens > 0 {
				output = data.Usage.OutputTokens
			}
			if data.Usage.InputTokens > 0 {
				input = data.Usage.InputTokens
			}
			cacheCreate = maxInt(cacheCreate, data.Usage.CacheCreationInputTokens)
			cacheRead = maxInt(cacheRead, data.Usage.CacheReadInputTokens)
		}
		// message_start.message.usage 带 input_tokens + cache_*
		if data.Message != nil && data.Message.Usage != nil {
			seen = true
			if data.Message.Usage.InputTokens > 0 {
				input = data.Message.Usage.InputTokens
			}
			cacheCreate = maxInt(cacheCreate, data.Message.Usage.CacheCreationInputTokens)
			cacheRead = maxInt(cacheRead, data.Message.Usage.CacheReadInputTokens)
		}
	}

	if !seen {
		return nil, nil
	}
	return &TokenUsage{
		PromptTokens:        input,
		CompletionTokens:    output,
		CacheCreationTokens: cacheCreate,
		CacheReadTokens:     cacheRead,
	}, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
