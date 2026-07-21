package main

import (
	"log/slog"
	"os"

	"github.com/XiaoleC05/oxelia51-backend/config"
	"github.com/XiaoleC05/oxelia51-backend/internal/app"
)

func main() {
	cfg := config.Load()
	cfg.Validate()

	var logHandler slog.Handler
	if os.Getenv("LOG_FORMAT") == "text" {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	} else {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	slog.SetDefault(slog.New(logHandler))

	r := app.New(cfg)

	addr := cfg.BindAddr()
	slog.Info("server started", "addr", addr)
	if err := r.Run(addr); err != nil {
		slog.Error("server start failed", "error", err)
		os.Exit(1)
	}
}
