# TOOL-05-3 验证步骤文档

## 前提条件
1. SuperRead 后端已编译（`cd SuperRead && go build -o superread ./cmd/server`）
2. Oxelia51 后端已编译（`cd Oxelia51/backend && go build ./cmd/server`）
3. PostgreSQL 数据库已运行

## 步骤 1：更新数据库

```bash
cd d:\07_Projects\code\Oxelia51
psql -U root -d oxelia51 -f deploy/seed-tools.sql
```

预期输出：
```
INSERT 0 6
INSERT 0 8
```

验证 superread 配置：
```bash
psql -U root -d oxelia51 -c "SELECT slug, internal_api_base FROM tools WHERE slug = 'superread';"
```

预期输出：
```
   slug    |    internal_api_base    
-----------+-------------------------
 superread | http://127.0.0.1:8002
(1 row)
```

## 步骤 2：启动 SuperRead 后端

```bash
cd d:\07_Projects\code\SuperRead
.\superread.exe
```

预期输出：
```
[GIN-debug] Listening and serving HTTP on 127.0.0.1:8002
```

验证 SuperRead 健康检查：
```bash
curl http://127.0.0.1:8002/api/health
```

预期输出：
```json
{"message":"ok"}
```

## 步骤 3：启动 Oxelia51 后端

```bash
cd d:\07_Projects\code\Oxelia51\backend
.\server.exe
```

预期输出：
```
Server started on :8080
```

## 步骤 4：测试 Gateway 代理

首先获取管理员 JWT token（假设已有管理员账号）：
```bash
curl -X POST http://127.0.0.1:8080/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"your_password\"}"
```

从响应中提取 access_token，然后测试 Gateway 代理：
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" ^
  http://127.0.0.1:8080/api/tools/superread/proxy/api/health
```

预期输出（HTTP 200）：
```json
{"message":"ok"}
```

## 步骤 5：验证环境变量覆盖

确认 Oxelia51 后端的 .env 文件中包含：
```
TOOL_API_BASE_SUPERREAD=http://127.0.0.1:8002
```

如果修改了 .env，需要重启 Oxelia51 后端。

## 服务器部署（可选）

如需部署到生产服务器（47.108.202.199），创建 systemd 服务文件：

```ini
# /etc/systemd/system/superread.service
[Unit]
Description=SuperRead Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=oxelia51
WorkingDirectory=/opt/SuperRead
ExecStart=/opt/SuperRead/superread
Restart=always
RestartSec=5
Environment="DATABASE_URL=postgres://oxelia51:your_password@localhost:5432/oxelia51?sslmode=disable"
Environment="SUPERREAD_PORT=8002"
Environment="OXELIA_GATEWAY_MODE=true"

[Install]
WantedBy=multi-user.target
```

启用并启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable superread
sudo systemctl start superread
sudo systemctl status superread
```

## 故障排查

### Gateway 返回 404
- 检查 tools 表中 superread 的 slug 是否正确
- 确认 seed-tools.sql 已执行

### Gateway 返回 502
- 检查 SuperRead 后端是否运行：`curl http://127.0.0.1:8002/api/health`
- 检查 .env 中 TOOL_API_BASE_SUPERREAD 是否正确
- 重启 Oxelia51 后端

### Gateway 返回 401
- 检查 JWT token 是否有效
- 确认 Authorization header 格式正确

### SuperRead 启动失败
- 检查 DATABASE_URL 环境变量
- 确认 PostgreSQL 数据库已创建 superread schema
