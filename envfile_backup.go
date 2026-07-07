package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

var (
	ManageableEnvKeys = []string{
		"CRAWLER_DORM_NUMBER",
		"CRAWLER_ROOM_ID",
		"CRAWLER_OPENID",
		"CRAWLER_JSESSIONID",
		"SCHEDULER_INTERVAL_HOURS",
		"ALERT_COOLDOWN_HOURS",
		"CRAWLER_ALERT_THRESHOLD",
		"QQ_ALERT_PAUSE_UNTIL",
		"QQ_BOT_ENABLED",
		"QQ_BOT_API_URL",
		"QQ_BOT_GROUP_ID",
	}

	SensitiveEnvKeys = map[string]bool{
		"CRAWLER_JSESSIONID": true,
		"DB_PASSWORD":        true,
		"ADMIN_PASSWORD":     true,
	}

	envMu   sync.Mutex
	envPath string
)

func init() {
	_, file, _, _ := runtime.Caller(0)
	envPath = filepath.Join(filepath.Dir(filepath.Dir(filepath.Dir(file))), ".env")
}

func EnvFilePath() string {
	return envPath
}

func ReadEnvValues() map[string]string {
	values := make(map[string]string)
	for _, k := range ManageableEnvKeys {
		values[k] = ""
	}

	data, err := os.ReadFile(envPath)
	if err != nil {
		return values
	}

	for _, line := range strings.Split(string(data), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.Contains(trimmed, "=") {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		key := strings.TrimSpace(parts[0])
		if _, ok := values[key]; ok {
			values[key] = strings.TrimSpace(parts[1])
		}
	}
	return values
}

func MaskEnvValues(values map[string]string) map[string]string {
	masked := make(map[string]string)
	for k, v := range values {
		if SensitiveEnvKeys[k] && v != "" {
			masked[k] = "******"
		} else {
			masked[k] = v
		}
	}
	return masked
}

func WriteEnvValues(updates map[string]string) error {
	allowed := make(map[string]bool)
	for _, k := range ManageableEnvKeys {
		allowed[k] = true
	}

	filtered := make(map[string]string)
	for k, v := range updates {
		if allowed[k] {
			filtered[k] = strings.TrimSpace(v)
		}
	}
	if len(filtered) == 0 {
		return nil
	}

	envMu.Lock()
	defer envMu.Unlock()

	var lines []string
	data, err := os.ReadFile(envPath)
	if err == nil {
		lines = strings.Split(string(data), "\n")
	}

	existingKeys := make(map[string]bool)
	var newLines []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.Contains(trimmed, "=") {
			newLines = append(newLines, line)
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		key := strings.TrimSpace(parts[0])
		if v, ok := filtered[key]; ok {
			newLines = append(newLines, key+"="+v)
			existingKeys[key] = true
		} else {
			newLines = append(newLines, line)
		}
	}

	for k, v := range filtered {
		if !existingKeys[k] {
			newLines = append(newLines, k+"="+v)
		}
	}

	return os.WriteFile(envPath, []byte(strings.Join(newLines, "\n")+"\n"), 0644)
}
