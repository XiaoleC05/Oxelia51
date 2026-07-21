# Nginx 代理 Tool Webhook 返回 405 Method Not Allowed

- **场景**：生产环境部署后，RSS 阅读器向 `https://oxelia51.com/api/tools/superread/webhook` 发送 POST 请求，被 Nginx 返回 405
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`deploy/nginx.conf` 中 `/api/tools/` location 块只配置了 GET/HEAD，未允许 POST；同时缺少 `proxy_pass` 到 backend 的 8080 端口
- **修复方案**：在 `/api/tools/` location 中加 `limit_except GET POST { deny all; }`，并补齐 `proxy_pass http://127.0.0.1:8080;` 与必要的 `proxy_set_header` 头
- **结果**：Webhook POST 请求能正常到达 backend；返回 200 状态码
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/e5f6a7b`
- **日期**：2026-07-07
