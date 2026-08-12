package localapi

import (
	"context"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// detectSpec 描述一个可本地探测的 AI Agent（传统定义：LLM + 执行框架 harness）。
// id 与 proxy/sessionizer.go InferAgent 的返回值对齐（检测与请求识别口径一致）。
// 不含 CC Switch 这类配置切换工具——它不承载 LLM 调用，不属于 agent。
type detectSpec struct {
	id     string   // Agent 标识（与 InferAgent 输出一致）
	label  string   // 展示名
	dirs   []string // home 相对配置路径（存在即视为已安装）
	bins   []string // CLI 二进制名（在 PATH 上即视为已安装；同时用于 --version 取版本号）
	vsxExt string   // VS Code 插件 ID（publisher.name）；检查 ~/.vscode/extensions/<id>-*
}

// detectSpecs 本地已安装 Agent 探测表（只读、不写配置）。
// 覆盖三类信号：CLI 命令、home 配置目录、VS Code 插件目录。
// 未收录路径不确定的（Trae / Qoder / Hermes / Kimi / 豆包 / Manus 等），避免误报，按已知路径补。
var detectSpecs = []detectSpec{
	// CLI + 配置目录（LLM + harness 的终端 agent）
	{id: "claude-code", label: "Claude Code", dirs: []string{".claude", ".claude.json"}, bins: []string{"claude"}},
	{id: "codex", label: "Codex CLI", dirs: []string{".codex"}, bins: []string{"codex"}},
	{id: "cursor", label: "Cursor", dirs: []string{".cursor"}},
	{id: "gemini-cli", label: "Gemini CLI", dirs: []string{".gemini"}, bins: []string{"gemini"}},
	{id: "aider", label: "Aider", dirs: []string{".aider", ".aider.conf.yml"}, bins: []string{"aider"}},
	{id: "opencode", label: "OpenCode", dirs: []string{".config/opencode"}, bins: []string{"opencode"}},
	{id: "windsurf", label: "Windsurf", dirs: []string{".codeium"}},
	// VS Code 插件类 agent（运行在编辑器内的 LLM + harness）
	{id: "cline", label: "Cline", vsxExt: "saoudrizwan.claude-dev"},
	{id: "roo-code", label: "Roo Code", vsxExt: "rooveterinaryinc.roo-cline"},
	{id: "continue", label: "Continue", vsxExt: "continue.continue"},
	{id: "copilot", label: "GitHub Copilot", vsxExt: "github.copilot"},
	{id: "augment", label: "Augment Code", vsxExt: "augmentcode.augmentcode"},
}

var semverRe = regexp.MustCompile(`\d+\.\d+\.\d+`)

// handleDetectTools GET /api/detect-tools：扫描本地已安装的 AI Agent 工具（只读，不改任何配置）。
// 返回已命中的工具清单（含版本号，CLI 用 --version、VS Code 插件从目录名解析），供接入页展示。
func (a *API) handleDetectTools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	home, err := os.UserHomeDir()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	type toolHit struct {
		ID      string `json:"id"`
		Label   string `json:"label"`
		Version string `json:"version"` // 空串 = 无法确定（GUI 应用等）
	}
	hits := []toolHit{}
	for _, s := range detectSpecs {
		if toolInstalled(home, s) {
			hits = append(hits, toolHit{ID: s.id, Label: s.label, Version: toolVersion(home, s)})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"detected": hits})
}

// toolInstalled 判断 agent 是否已安装：PATH 命中 CLI 二进制、home 配置路径存在，
// 或 VS Code 插件目录存在对应插件。
func toolInstalled(home string, s detectSpec) bool {
	for _, bin := range s.bins {
		if _, err := exec.LookPath(bin); err == nil {
			return true
		}
	}
	for _, d := range s.dirs {
		if _, err := os.Stat(filepath.Join(home, filepath.FromSlash(d))); err == nil {
			return true
		}
	}
	if s.vsxExt != "" && vsxInstalled(home, s.vsxExt) {
		return true
	}
	return false
}

// toolVersion 获取已安装版本号：CLI 优先（--version），VS Code 插件从目录名解析。
func toolVersion(home string, s detectSpec) string {
	for _, bin := range s.bins {
		if v := cliVersion(bin); v != "" {
			return v
		}
	}
	if s.vsxExt != "" {
		if v := vsxVersion(home, s.vsxExt); v != "" {
			return v
		}
	}
	return ""
}

// cliVersion 运行 <bin> --version 并提取首个 semver 版本号（2s 超时，避免个别工具卡住）。
func cliVersion(bin string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, "--version").CombinedOutput()
	if err != nil {
		return ""
	}
	return semverRe.FindString(string(out))
}

// vsxInstalled 检查 ~/.vscode/extensions/ 下是否存在 <publisher>.<name>-<version> 形式的插件目录。
// 前缀匹配（忽略大小写，Windows 文件系统大小写不敏感；macOS/Linux 亦按小写比对）。
func vsxInstalled(home, extID string) bool {
	_, ok := vsxDir(home, extID)
	return ok
}

// vsxVersion 从插件目录名 <publisher>.<name>-<version> 提取版本号。
// 用长度切片而非 TrimPrefix：目录名大小写可能与 extID 不一致（vsxDir 是忽略大小写匹配）。
func vsxVersion(home, extID string) string {
	name, ok := vsxDir(home, extID)
	if !ok {
		return ""
	}
	if len(name) > len(extID)+1 {
		return name[len(extID)+1:]
	}
	return ""
}

// vsxDir 在 ~/.vscode/extensions/ 下查找匹配插件目录，返回目录名（原样大小写）。
func vsxDir(home, extID string) (string, bool) {
	dir := filepath.Join(home, ".vscode", "extensions")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", false
	}
	prefix := strings.ToLower(extID) + "-"
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(strings.ToLower(e.Name()), prefix) {
			return e.Name(), true
		}
	}
	return "", false
}
