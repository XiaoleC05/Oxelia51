package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const defaultJWTSecret = "change-me-in-production"

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	ServerPort string
	ListenAddr string
	JWTSecret  string

	RedisAddr string

	AdminInitialPassword string

	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	GatewayUpstreamTimeout time.Duration
	GatewayMaxBodyBytes    int64
	GatewayHMACSecret      string
	ToolAdminTokens        map[string]string

	// CORSOrigin Access-Control-Allow-Origin 唯一允许的跨域来源（生产站点）
	CORSOrigin string
	// AdminStatsAllowedIP 远程服务器统计（TENCENT_HEALTH_URL）允许的主机白名单，
	// 默认生产服务器 IP；loopback（127.0.0.1/localhost）始终允许
	AdminStatsAllowedIP string
	// GatewayStatusURL 本机 proxy-gateway 状态接口地址（GatewayStats 的代理目标）
	GatewayStatusURL string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "root"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "oxelia51"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
		ListenAddr: getEnv("LISTEN_ADDR", ""),
		JWTSecret:  getEnv("JWT_SECRET", defaultJWTSecret),

		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),

		AdminInitialPassword: os.Getenv("ADMIN_INITIAL_PASSWORD"),

		AccessTokenTTL:  getEnvDuration("ACCESS_TOKEN_TTL", 7*24*time.Hour),
		RefreshTokenTTL: getEnvDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),

		GatewayUpstreamTimeout: getEnvDuration("GATEWAY_UPSTREAM_TIMEOUT", 30*time.Second),
		GatewayMaxBodyBytes:    getEnvInt64("GATEWAY_MAX_BODY_BYTES", 10<<20),
		GatewayHMACSecret:      getEnv("GATEWAY_HMAC_SECRET", ""),
		ToolAdminTokens:        parseToolTokens(),

		CORSOrigin:          getEnv("CORS_ORIGIN", "https://oxelia51.com"),
		AdminStatsAllowedIP: getEnv("ADMIN_STATS_ALLOWED_IP", "118.25.138.177"),
		GatewayStatusURL:    getEnv("GATEWAY_STATUS_URL", "http://127.0.0.1:9090/api/proxy/status"),
	}
}

// Validate 检查生产环境关键配置，防止弱密钥/默认值上生产。
func (c *Config) Validate() {
	if c.JWTSecret == defaultJWTSecret || len(c.JWTSecret) < 16 {
		log.Fatal("JWT_SECRET 未配置或过短（<16字符），拒绝启动。请在 .env 中设置强密钥")
	}
	if c.DBPassword == "" {
		log.Fatal("DB_PASSWORD 未配置，拒绝启动")
	}
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName,
	)
}

// BindAddr 返回 HTTP 监听地址（生产默认仅 loopback）
func (c *Config) BindAddr() string {
	if v := strings.TrimSpace(c.ListenAddr); v != "" {
		return v
	}
	return ":" + c.ServerPort
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

func getEnvInt64(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return fallback
	}
	return n
}

// parseToolTokens reads TOOL_ADMIN_TOKEN_<SLUG> env vars
func parseToolTokens() map[string]string {
	tokens := make(map[string]string)
	for _, e := range os.Environ() {
		if !strings.HasPrefix(e, "TOOL_ADMIN_TOKEN_") {
			continue
		}
		parts := strings.SplitN(e, "=", 2)
		if len(parts) != 2 {
			continue
		}
		slug := strings.ToLower(strings.TrimPrefix(parts[0], "TOOL_ADMIN_TOKEN_"))
		tokens[slug] = parts[1]
	}
	return tokens
}
