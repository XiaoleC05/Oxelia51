package main

import (
	"context"
	"log"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/database"
	"github.com/XiaoleC05/oxelia51-backend/internal/handler"

	"github.com/XiaoleC05/oxelia51-backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. 加载配置
	cfg := config.Load()

	// 2. 连接数据库
	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DSN())
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	defer pool.Close()

	// 3. 创建 Gin 路由
	r := gin.Default()

	// 4. 注册路由
	h := handler.NewHealthHandler(pool)
	r.GET("/api/health", h.Health)
	auth := handler.NewAuthHandler(pool, cfg)
	// 认证相关路由
	r.POST("/api/auth/register", auth.Register)
	r.POST("/api/auth/login", auth.Login)

	// 工具相关路由
	tool := handler.NewToolHandler(pool)
	r.GET("/api/tools", tool.List)
	r.GET("/api/tools/:id", tool.Get)

	// 受保护的路由组（需要 JWT 认证）
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg))
	{
		protected.GET("/users/me", auth.Me)
		protected.POST("/tools", tool.Create)
		protected.PUT("/tools/:id", tool.Update)
		protected.DELETE("/tools/:id", tool.Delete)
	}

	// 5. 启动服务
	addr := ":" + cfg.ServerPort
	log.Printf("服务启动: http://localhost%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
