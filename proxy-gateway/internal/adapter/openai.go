package adapter

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// OpenAIAdapter 适配 OpenAI 协议（OpenAI / DeepSeek / Moonshot / 智谱）
type OpenAIAdapter struct {
	name string
}

func NewOpenAIAdapter(name string) *OpenAIAdapter {
	return &OpenAIAdapter{name: name}
}

func (a *OpenAIAdapter) ProviderName() string { return a.name }

// ExtractUsage 从非流式 JSON 响应中提取 usage
func (a *OpenAIAdapter) ExtractUsage(resp *http.Response) (*TokenUsage, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Model string `json:"model"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	return &TokenUsage{
		PromptTokens:     data.Usage.PromptTokens,
		CompletionTokens: data.Usage.CompletionTokens,
		TotalTokens:      data.Usage.TotalTokens,
	}, nil
}

// ExtractUsageFromStream 从 SSE 流中提取 usage（最后一条 data: 行的 usage 字段）
func (a *OpenAIAdapter) ExtractUsageFromStream(reader io.Reader) (*TokenUsage, error) {
	scanner := bufio.NewScanner(reader)
	// SSE 行可能较长，增大 buffer
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var lastUsage *TokenUsage

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" {
			break
		}

		var data struct {
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
				TotalTokens      int `json:"total_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal([]byte(payload), &data); err != nil {
			continue
		}
		if data.Usage != nil {
			lastUsage = &TokenUsage{
				PromptTokens:     data.Usage.PromptTokens,
				CompletionTokens: data.Usage.CompletionTokens,
				TotalTokens:      data.Usage.TotalTokens,
			}
		}
	}

	return lastUsage, nil
}
