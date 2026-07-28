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
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	return &TokenUsage{
		PromptTokens:     data.Usage.InputTokens,
		CompletionTokens: data.Usage.OutputTokens,
		TotalTokens:      data.Usage.InputTokens + data.Usage.OutputTokens,
	}, nil
}

// ExtractUsageFromStream 从 SSE 流中提取 usage
// Anthropic SSE 格式：message_delta 事件包含 usage
func (a *AnthropicAdapter) ExtractUsageFromStream(reader io.Reader) (*TokenUsage, error) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var lastUsage *TokenUsage

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")

		var data struct {
			Type string `json:"type"`
			Usage *struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"usage"`
			Message *struct {
				Usage *struct {
					InputTokens  int `json:"input_tokens"`
					OutputTokens int `json:"output_tokens"`
				} `json:"usage"`
			} `json:"message"`
		}
		if err := json.Unmarshal([]byte(payload), &data); err != nil {
			continue
		}
		// message_start 事件包含 message.usage（input_tokens）
		// message_delta 事件包含 usage（output_tokens）
		if data.Usage != nil {
			lastUsage = &TokenUsage{
				PromptTokens:     data.Usage.InputTokens,
				CompletionTokens: data.Usage.OutputTokens,
				TotalTokens:      data.Usage.InputTokens + data.Usage.OutputTokens,
			}
		}
		if data.Message != nil && data.Message.Usage != nil {
			lastUsage = &TokenUsage{
				PromptTokens:     data.Message.Usage.InputTokens,
				CompletionTokens: data.Message.Usage.OutputTokens,
				TotalTokens:      data.Message.Usage.InputTokens + data.Message.Usage.OutputTokens,
			}
		}
	}

	return lastUsage, nil
}
