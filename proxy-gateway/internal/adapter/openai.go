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
			// Response API（/v1/responses）字段：input_tokens / output_tokens
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	prompt, completion := data.Usage.PromptTokens, data.Usage.CompletionTokens
	if prompt == 0 && completion == 0 {
		// Chat Completions 用 prompt_tokens/completion_tokens；Response API 用 input/output
		prompt, completion = data.Usage.InputTokens, data.Usage.OutputTokens
	}
	return &TokenUsage{
		PromptTokens:     prompt,
		CompletionTokens: completion,
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
				InputTokens      int `json:"input_tokens"`
				OutputTokens     int `json:"output_tokens"`
			} `json:"usage"`
			// Response API 流式：usage 嵌套在 response 对象里（response.completed 事件）
			Response *struct {
				Usage *struct {
					InputTokens  int `json:"input_tokens"`
					OutputTokens int `json:"output_tokens"`
					TotalTokens  int `json:"total_tokens"`
				} `json:"usage"`
			} `json:"response"`
		}
		if err := json.Unmarshal([]byte(payload), &data); err != nil {
			continue
		}
		if data.Usage != nil {
			prompt, completion := data.Usage.PromptTokens, data.Usage.CompletionTokens
			if prompt == 0 && completion == 0 {
				prompt, completion = data.Usage.InputTokens, data.Usage.OutputTokens
			}
			lastUsage = &TokenUsage{
				PromptTokens:     prompt,
				CompletionTokens: completion,
				TotalTokens:      data.Usage.TotalTokens,
			}
		} else if data.Response != nil && data.Response.Usage != nil {
			lastUsage = &TokenUsage{
				PromptTokens:     data.Response.Usage.InputTokens,
				CompletionTokens: data.Response.Usage.OutputTokens,
				TotalTokens:      data.Response.Usage.TotalTokens,
			}
		}
	}

	return lastUsage, nil
}
