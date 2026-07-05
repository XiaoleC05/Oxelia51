package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	ServerPort string
	JWTSecret  string

	RedisAddr string

	AppPublicURL string

	AdminInitialPassword string

	MailFrom     string
	MailFromName string
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPass     string
	SMTPTLS      bool

	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	EmailTokenTTL   time.Duration

	// CodeRoot 本地项目扫描根目录（tool-registration v1.1）
	CodeRoot string

	GatewayUpstreamTimeout time.Duration
	GatewayMaxBodyBytes    int64
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
		JWTSecret:  getEnv("JWT_SECRET", "change-me-in-production"),

		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),

		AppPublicURL: getEnv("APP_PUBLIC_URL", "http://localhost:5173"),

		AdminInitialPassword: os.Getenv("ADMIN_INITIAL_PASSWORD"),

		MailFrom:     getEnv("MAIL_FROM", "noreply@oxelia51.com"),
		MailFromName: getEnv("MAIL_FROM_NAME", "Oxelia51"),
		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "465"),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPass:     getEnv("SMTP_PASS", ""),
		SMTPTLS:      getEnvBool("SMTP_TLS", true),

		AccessTokenTTL:  getEnvDuration("ACCESS_TOKEN_TTL", 7*24*time.Hour),
		RefreshTokenTTL: getEnvDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		EmailTokenTTL:   getEnvDuration("EMAIL_TOKEN_TTL", 24*time.Hour),

		CodeRoot: getEnv("CODE_ROOT", `D:\07_Projects\code`),

		GatewayUpstreamTimeout: getEnvDuration("GATEWAY_UPSTREAM_TIMEOUT", 30*time.Second),
		GatewayMaxBodyBytes:    getEnvInt64("GATEWAY_MAX_BODY_BYTES", 10<<20),
	}
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName,
	)
}

func (c *Config) SMTPConfigured() bool {
	return c.SMTPHost != "" && c.SMTPUser != "" && c.SMTPPass != ""
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
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
