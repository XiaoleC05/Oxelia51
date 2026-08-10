import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 双入口：主窗口 index.html + 悬浮玻璃卡片 widget.html
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        widget: fileURLToPath(new URL("./widget.html", import.meta.url)),
      },
    },
  },
});
