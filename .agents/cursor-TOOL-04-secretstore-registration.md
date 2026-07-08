---
from: Codex (Architecture Agent)
to: Cursor (Backend Agent)
task: TOOL-04
status: blocked_by_TOOL-02
date: 2026-07-08
depends_on: TOOL-02
blocks: none
---


> **Cursor 职责边界（AGENTS.md §4.2）**
> - ✅ 可修改：后端源代码、后端配置、后端测试、后端文档
> - ❌ 不得修改：前端、UI、CSS、项目架构、数据库设计、API 规范、CI/CD 工作流
> - ⚠️ 上报：数据库模式变更、API 变更、框架变更、项目结构变更、第三方依赖变更
> - **完成标准**：代码编译通过、逻辑正确、现有功能不受影响、无未完成代码


# TOOL-04：SecretStore Oxelia51 注册 + Gateway 接入

## 背景

SecretStore 后端（TOOL-02）完成后，需要在 Oxelia51 平台中注册该工具并接入 API Gateway。
这是最后一步集成工作。

## 任务

### 1. 工具注册

在 Oxelia51 `tools` 表中插入 SecretStore 记录：

```sql
INSERT INTO tools (slug, name, description, user_accessible, status, online_capable, port)
VALUES ('secretstore', 'SecretStore', '加密存储 API 密钥、密码等敏感信息', true, 'enabled', true, 8001);
```

### 2. 环境变量

在 Oxelia51 后端 `.env` 中新增：

```
SECRETSTORE_ENCRYPTION_KEY=<32 字节 hex>
TOOL_API_BASE_SECRETSTORE=http://127.0.0.1:8001
```

更新 `.env.example` 同步上述变量。

### 3. Gateway 路由注册

在 `backend/internal/gateway/` 中确认 SecretStore 工具可通过 `/api/tools/secretstore/proxy/*path` 访问。

Gateway 应已支持动态路由（通过 `tools` 表中的 `port` 字段），如不支持则需修改。
验证流程：确保 gateway 已能根据 tools 表记录自动注册代理路由。

### 4. 部署

在服务器上：

```bash
# 创建 SecretStore systemd 服务
# /etc/systemd/system/secretstore.service
# [Service]
# ExecStart=/opt/SecretStore/secretstore-server
```

操作通过阿里云 Workbench 执行。

## 接受标准

- [ ] `GET /api/tools/secretstore` 返回工具元数据
- [ ] `GET /api/tools` 列表中包含 SecretStore
- [ ] Gateway 代理 `/api/tools/secretstore/proxy/api/health` → 200
- [ ] 环境变量已配置
- [ ] `.env.example` 已同步
- [ ] systemd 服务文件就绪
*** End of File
