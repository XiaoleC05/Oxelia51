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
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/localapi"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/proxy"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/recorder"
	"github.com/XiaoleC05/Oxelia51/proxy-gateway/internal/stats"
)

func main() {
	port := os.Getenv("PROXY_PORT")
	if port == "" {
		if os.Getenv("LOCAL_MODE") == "true" {
			port = "17800" // 本地优先默认端口（设计 §6.1）
		} else {
			port = "9090"
		}
	}

	// 组装依赖
	adapterRegistry := adapter.NewRegistry()
	startTime := time.Now()

	// 记录器：本地优先用 SQLite（P3 桌面端），云端用 ClickHouse
	localMode := os.Getenv("LOCAL_MODE") == "true"

	chAddr := os.Getenv("CLICKHOUSE_ADDR")
	chUser := os.Getenv("CLICKHOUSE_USER")
	chPassword := os.Getenv("CLICKHOUSE_PASSWORD")

	var rec recorder.Recorder
	var sqliteWriter *recorder.SQLiteWriter
	if localMode {
		sqlitePath := os.Getenv("SQLITE_PATH")
		sw, err := recorder.NewSQLiteWriter(sqlitePath)
		if err != nil {
			log.Fatalf("sqlite init failed: %v", err)
		}
		sqliteWriter = sw
		rec = recorder.NewChannelRecorder(sw)
	} else if chAddr != "" {
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

	// 限流器（本地优先放宽，个人本机使用）
	ratePerMin := 60
	if localMode {
		ratePerMin = 600
	}
	lm := limiter.NewRateLimiter(ratePerMin)

	// 网关统计器
	st := stats.New()

	// 代理密钥鉴权（proxy_keys 表，阿里云 PG 同机）
	// PROXY_PG_URL 示例：postgres://root:xxx@127.0.0.1:5432/oxelia51?sslmode=disable
	authMode := os.Getenv("PROXY_AUTH_MODE") // "optional"（默认）/ "required"
	if authMode == "" {
		authMode = "optional"
	}
	var ks *proxy.KeyStore
	if localMode {
		// 本地优先：个人本机，不做代理密钥鉴权
		authMode = "optional"
	} else if dsn := os.Getenv("PROXY_PG_URL"); dsn != "" {
		var err error
		ks, err = proxy.NewKeyStore(context.Background(), dsn)
		if err != nil {
			if authMode == "required" {
				log.Fatalf("proxy keystore init failed (required mode): %v", err)
			}
			log.Printf("proxy keystore init failed, falling back to X-Project-ID only: %v", err)
			ks = nil
		} else {
			defer ks.Close()
		}
	} else if authMode == "required" {
		log.Fatal("PROXY_AUTH_MODE=required but PROXY_PG_URL not set")
	}

	// 转发器
	forwarder := proxy.NewForwarder(adapterRegistry, rec, st)

	// 路由
	mux := http.NewServeMux()
	proxy.SetupRoutes(mux, forwarder, lm, adapterRegistry.Providers(), startTime, st, ks, authMode)

	// 本地优先：挂只读统计接口（桌面 UI 数据源）
	if localMode && sqliteWriter != nil {
		api := localapi.New(sqliteWriter.DB())
		mux.Handle("/api/", api.Handler())
		// 自定义供应商：静态路由表查无后按 slug 回退解析（见 adapter/custom.go）
		adapterRegistry.SetCustomSource(api.CustomSource())
	}

	// 本地优先模式只听回环（#5：原 0.0.0.0 让同网段任意主机可读账本 / 改设置）；
	// 云端模式仍监听全部地址（nginx 同机反代）。
	addr := ":" + port
	if localMode {
		addr = "127.0.0.1:" + port
	}
	srv := &http.Server{
		Addr:         addr,
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
