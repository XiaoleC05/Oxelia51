package main

import (
	"context"
	"log"
	"path/filepath"

	"github.com/XiaoleC05/oxelia51-backend/internal/admin"
	"github.com/XiaoleC05/oxelia51-backend/internal/auth"
	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/database"
	"github.com/XiaoleC05/oxelia51-backend/internal/gateway"
	"github.com/XiaoleC05/oxelia51-backend/internal/handler"
	"github.com/XiaoleC05/oxelia51-backend/internal/mailer"
	"github.com/XiaoleC05/oxelia51-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	cfg.Validate()
	ctx := context.Background()

	pool, err := database.Connect(ctx, cfg.DSN())
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	defer pool.Close()

	migrationsDir := filepath.Join("migrations")
	if err := database.RunMigrations(ctx, pool, migrationsDir); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	if err := admin.EnsureAdmin(ctx, pool, cfg); err != nil {
		log.Fatalf("管理员种子失败: %v", err)
	}

	rdb, err := database.ConnectRedis(ctx, cfg.RedisAddr)
	if err != nil {
		log.Fatalf("Redis 连接失败: %v", err)
	}
	defer rdb.Close()

	tokenSvc := auth.NewTokenService(cfg)
	rl := auth.NewRateLimiter(rdb)
	emailStore := auth.NewEmailTokenStore(rdb, cfg.EmailTokenTTL)
	refreshStore := auth.NewRefreshStore(rdb, cfg.RefreshTokenTTL)
	blacklist := auth.NewJWTBlacklist(rdb)
	m := mailer.New(cfg)

	r := gin.Default()

	// 仅信任本机 Nginx 作为反代，防止客户端伪造 X-Forwarded-For 污染限流 key。
	// Nginx 在 127.0.0.1 转发，c.ClientIP() 将读取可信的 X-Forwarded-For。
	if err := r.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		log.Printf("警告: 设置可信代理失败: %v", err)
	}

	health := handler.NewHealthHandler(pool)
	r.GET("/api/health", health.Health)

	authH := handler.NewAuthHandlerWithDeps(pool, cfg, m, tokenSvc, rl, emailStore, refreshStore, blacklist)
	r.POST("/api/auth/register", authH.Register)
	r.GET("/api/auth/verify-email", authH.VerifyEmail)
	r.POST("/api/auth/resend-verification", authH.ResendVerification)
	r.POST("/api/auth/login", authH.Login)
	r.POST("/api/auth/refresh", authH.Refresh)
	r.POST("/api/auth/forgot-password", authH.ForgotPassword)
	r.POST("/api/auth/reset-password", authH.ResetPassword)

	tool := handler.NewToolHandler(pool)
	r.GET("/api/tools", tool.List)
	r.GET("/api/tools/:slug", tool.Get)
	r.GET("/api/portfolio", tool.ListPortfolioPublic)

	// 首页头图轮播（公开读）
	heroH := handler.NewHeroHandler(pool)
	r.GET("/api/hero-images", heroH.ListPublic)

	authMW := middleware.NewAuthMiddleware(cfg, tokenSvc, blacklist)
	protected := r.Group("/api")
	protected.Use(authMW.Handle())
	{
		protected.POST("/auth/logout", authH.Logout)
		protected.GET("/users/me", authH.Me)

		gw := gateway.NewHandler(pool, cfg)
		protected.Any("/tools/:slug/proxy/*path", gw.Proxy)
	}

	adminTool := handler.NewAdminToolHandler(pool, cfg)
	admin := r.Group("/api/admin")
	admin.Use(authMW.Handle(), middleware.RequireAdmin())
	{
		admin.GET("/tools", adminTool.ListTools)
		admin.PATCH("/tools/:slug", adminTool.PatchTool)
		admin.POST("/tools/scan-local", adminTool.ScanLocal)
		admin.GET("/users", adminTool.ListUsers)
		admin.PATCH("/users/:id", adminTool.PatchUser)
		admin.GET("/portfolio", adminTool.ListPortfolio)
		admin.PUT("/portfolio/:slug", adminTool.UpdatePortfolio)
		admin.GET("/hero-images", heroH.ListAdmin)
		admin.POST("/hero-images", heroH.Create)
		admin.PUT("/hero-images/:id", heroH.Update)
		admin.DELETE("/hero-images/:id", heroH.Delete)
		admin.POST("/hero-images/upload", heroH.Upload)
	}

	addr := cfg.BindAddr()
	log.Printf("服务启动: %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
