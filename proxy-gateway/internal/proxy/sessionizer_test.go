package proxy

import "testing"

// TestInferAgent 锁住 UA → Agent 识别映射（#问题 4 自动识别增强）。
// 新增工具在此登记；识别失败统一归 "其他"，前端别名机制可再改名。
func TestInferAgent(t *testing.T) {
	cases := []struct {
		ua   string
		want string
	}{
		{"claude-code/1.0.123", "claude-code"},
		{"Claude-CLI/2.0", "claude-code"},
		{"anthropic-cli/0.1", "claude-code"},
		{"codex/1.0", "codex"},
		{"Cursor/1.0", "cursor"},
		{"Trae/0.5", "trae"},
		{"Qoder/2.0", "qoder"},
		{"Hermes/1.0", "hermes"},
		{"Windsurf/1.0", "windsurf"},
		{"cc-switch/1.0", "cc-switch"},
		{"ccv/1.0", "ccv"},
		{"chatgpt/1.0", "openai"},
		{"OpenAI API", "openai"},
		// 增强识别（2026-08）
		{"gemini-cli/1.0", "gemini-cli"},
		{"Cline/3.0", "cline"},
		{"Roo-Code/1.0", "roo-code"},
		{"Continue/1.0", "continue"},
		{"aider/0.50", "aider"},
		{"opencode/1.0", "opencode"},
		{"Augment/1.0", "augment"},
		{"GitHub Copilot/1.0", "copilot"},
		{"kimi/1.0", "kimi"},
		{"doubao/1.0", "doubao"},
		{"Manus/1.0", "manus"},
		{"some-random-client", "其他"},
		{"", "其他"},
	}
	for _, c := range cases {
		if got := InferAgent(c.ua); got != c.want {
			t.Errorf("InferAgent(%q) = %q, want %q", c.ua, got, c.want)
		}
	}
}
