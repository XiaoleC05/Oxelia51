package app

import (
	"context"
	"log/slog"
	"net/http/pprof"
	"os"
	"path/filepath"

	"github.com/XiaoleC05/oxelia51-backend/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/admin"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/article"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/auth"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/developer"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/health"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/hero"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/tool"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/user"
	"github.com/XiaoleC05/oxelia51-backend/internal/domain/weather"
	"github.com/XiaoleC05/oxelia51-backend/internal/gateway"
	"github.com/XiaoleC05/oxelia51-backend/internal/infra"
	"github.com/XiaoleC05/oxelia51-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func New(cfg *config.Config) *gin.Engine {
	ctx := context.Background()

	pool, err := infra.Connect(ctx, cfg.DSN())
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}

	migrationsDir := filepath.Join("migrations")
	if err := infra.RunMigrations(ctx, pool, migrationsDir); err != nil {
		slog.Error("database migration failed", "error", err)
		os.Exit(1)
	}

	if err := user.EnsureAdmin(ctx, pool, cfg); err != nil {
		slog.Error("admin seeding failed", "error", err)
		os.Exit(1)
	}

	rdb, err := infra.ConnectRedis(ctx, cfg.RedisAddr)
	if err != nil {
		slog.Error("redis connection failed", "error", err)
		os.Exit(1)
	}

	// Service & repository init
	tokenSvc := auth.NewTokenService(cfg)
	rl := auth.NewRateLimiter(rdb)
	emailStore := auth.NewEmailTokenStore(rdb, cfg.EmailTokenTTL)
	refreshStore := auth.NewRefreshStore(rdb, cfg.RefreshTokenTTL)
	blacklist := auth.NewJWTBlacklist(rdb)
	pendingStore := auth.NewPendingRegistrationStore(rdb, cfg.EmailTokenTTL)
	m := infra.NewMailer(cfg)
	userRepo := user.NewRepository(pool)

	r := gin.Default()

	if err := r.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		slog.Warn("trusted proxy setup failed", "error", err)
	}

	// pprof
	r.GET("/debug/pprof/", gin.WrapF(pprof.Index))
	r.GET("/debug/pprof/cmdline", gin.WrapF(pprof.Cmdline))
	r.GET("/debug/pprof/profile", gin.WrapF(pprof.Profile))
	r.GET("/debug/pprof/symbol", gin.WrapF(pprof.Symbol))
	r.GET("/debug/pprof/trace", gin.WrapF(pprof.Trace))
	r.GET("/debug/pprof/heap", gin.WrapH(pprof.Handler("heap")))
	r.GET("/debug/pprof/goroutine", gin.WrapH(pprof.Handler("goroutine")))
	r.GET("/debug/pprof/allocs", gin.WrapH(pprof.Handler("allocs")))
	r.GET("/debug/pprof/block", gin.WrapH(pprof.Handler("block")))
	r.GET("/debug/pprof/mutex", gin.WrapH(pprof.Handler("mutex")))

	// Handler init
	healthH := health.NewHealthHandler(pool)
	weatherH := weather.NewWeatherHandler(rdb)
	authH := auth.NewAuthHandlerWithDeps(pool, cfg, m, tokenSvc, rl, emailStore, refreshStore, blacklist, pendingStore, userRepo)
	userH := user.NewUserHandler(pool, userRepo)
	toolH := tool.NewToolHandler(pool)
	heroH := hero.NewHeroHandler(pool)
	devH := developer.NewDeveloperHandler(pool)
	articleH := article.NewArticleHandler(pool)

	// Public routes
	r.GET("/api/health", healthH.Health)
	r.GET("/api/uptime", healthH.Uptime)
	r.GET("/api/weather", weatherH.GetWeather)
	r.POST("/api/auth/register", authH.Register)
	r.GET("/api/auth/verify-email", authH.VerifyEmail)
	r.POST("/api/auth/resend-verification", authH.ResendVerification)
	r.POST("/api/auth/login", authH.Login)
	r.POST("/api/auth/refresh", authH.Refresh)
	r.POST("/api/auth/forgot-password", authH.ForgotPassword)
	r.POST("/api/auth/reset-password", authH.ResetPassword)
	r.GET("/api/tools", toolH.List)
	r.GET("/api/tools/:slug", toolH.Get)
	r.GET("/api/portfolio", toolH.ListPortfolioPublic)
	r.GET("/api/hero-images", heroH.ListPublic)
	r.GET("/api/developer/profile", devH.GetProfile)
	r.GET("/api/articles", articleH.ListPublic)
	r.GET("/api/articles/categories", articleH.Categories)
	r.GET("/api/articles/:id", articleH.GetPublic)
	r.GET("/api/pages/:slug", articleH.GetPage)
	r.GET("/api/search", articleH.Search)

	// Protected routes
	authMW := middleware.NewAuthMiddleware(cfg, tokenSvc, blacklist)
	protected := r.Group("/api")
	protected.Use(authMW.Handle())
	{
		protected.POST("/auth/logout", authH.Logout)
		protected.GET("/users/me", userH.Me)
		protected.PATCH("/auth/profile", userH.PatchProfile)

		gw := gateway.NewHandler(pool, cfg)
		protected.Any("/tools/:slug/proxy/*path", gw.Proxy)
	}

	// Admin routes
	whitelistRepo := admin.NewWhitelistRepository(pool)
	whitelistH := admin.NewWhitelistHandler(whitelistRepo)
	adminTool := tool.NewAdminToolHandler(pool, cfg)
	adminGroup := r.Group("/api/admin")
	adminGroup.Use(authMW.Handle(), middleware.RequireAdmin(), middleware.IPWhitelist(whitelistRepo))
	{
		adminGroup.GET("/tools", adminTool.ListTools)
		adminGroup.PATCH("/tools/:slug", adminTool.PatchTool)
		adminGroup.POST("/tools/scan-local", adminTool.ScanLocal)
		adminGroup.GET("/users", adminTool.ListUsers)
		adminGroup.PATCH("/users/:id", adminTool.PatchUser)
		adminGroup.DELETE("/users/:id", adminTool.DeleteUser)
		adminGroup.GET("/portfolio", adminTool.ListPortfolio)
		adminGroup.PUT("/portfolio/:slug", adminTool.UpdatePortfolio)
		adminGroup.GET("/hero-images", heroH.ListAdmin)
		adminGroup.POST("/hero-images", heroH.Create)
		adminGroup.PUT("/hero-images/:id", heroH.Update)
		adminGroup.DELETE("/hero-images/:id", heroH.Delete)
		adminGroup.POST("/hero-images/upload", heroH.Upload)
		adminGroup.PUT("/carousel-settings", heroH.UpdateCarouselSettings)
		adminGroup.PATCH("/developer/profile", devH.PatchProfile)
		adminGroup.GET("/developer/profile", devH.GetProfileAdmin)
		adminGroup.GET("/articles", articleH.ListAdmin)
		adminGroup.POST("/articles", articleH.Create)
		adminGroup.PUT("/articles/:id", articleH.Update)
		adminGroup.DELETE("/articles/:id", articleH.Delete)
		adminGroup.GET("/pages", articleH.ListPagesAdmin)
		adminGroup.PUT("/pages/:slug", articleH.UpdatePage)

		statsH := admin.NewStatsHandler()
		adminGroup.GET("/server-stats", statsH.ServerStats)
		adminGroup.GET("/dashboard-stats", adminTool.DashboardStats)

		adminGroup.GET("/ip-whitelist", whitelistH.ListWhitelist)
		adminGroup.POST("/ip-whitelist", whitelistH.CreateWhitelist)
		adminGroup.DELETE("/ip-whitelist/:id", whitelistH.DeleteWhitelist)

		adminGroup.POST("/exec", admin.Exec)
	}

	return r
}
