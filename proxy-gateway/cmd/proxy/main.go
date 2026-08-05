package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/adapter"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/limiter"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/proxy"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/recorder"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/stats"
)

func main() {
	port := os.Getenv("PROXY_PORT")
	if port == "" {
		port = "9090"
	}

	// 组装依赖
	adapterRegistry := adapter.NewRegistry()
	startTime := time.Now()

	// ClickHouse 记录器
	chAddr := os.Getenv("CLICKHOUSE_ADDR")
	chUser := os.Getenv("CLICKHOUSE_USER")
	chPassword := os.Getenv("CLICKHOUSE_PASSWORD")

	var rec recorder.Recorder
	if chAddr != "" {
		chRec, chWriter, err := recorder.NewClickHouseRecorder(chAddr, chUser, chPassword)
		if err != nil {
			log.Printf("clickhouse init failed, using no-op recorder: %v", err)
			rec = recorder.NewChannelRecorder(&noopWriter{})
		} else {
			rec = chRec
			defer chWriter.Close()
		}
	} else {
		log.Println("CLICKHOUSE_ADDR not set, using no-op recorder")
		rec = recorder.NewChannelRecorder(&noopWriter{})
	}
	defer rec.Close()

	// 限流器
	ratePerMin := 60
	lm := limiter.NewRateLimiter(ratePerMin)

	// 网关统计器
	st := stats.New()

	// 转发器
	forwarder := proxy.NewForwarder(adapterRegistry, rec, st)

	// 路由
	mux := http.NewServeMux()
	proxy.SetupRoutes(mux, forwarder, lm, adapterRegistry.Providers(), startTime, st)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 10 * time.Minute, // SSE 流式响应可能很长
		IdleTimeout:  60 * time.Second,
	}

	// 优雅关闭
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("shutting down...")
		rec.Flush()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("proxy gateway listening on :%s", port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	log.Println("server stopped")
}

// noopWriter 用于 ClickHouse 不可用时的空操作
type noopWriter struct{}

func (n *noopWriter) WriteBatch(records []adapter.TokenRecord) error {
	return nil
}
