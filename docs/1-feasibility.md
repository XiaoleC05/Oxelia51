# 可行性分析

**项目**：oxelia51.com | **版本**：3.0.0 | **日期**：2026-07-28

---

## 1. 背景

AI 编程工具（Claude Code、Cursor、GitHub Copilot 等）的 Token 消耗缺乏统一的监控手段：

- 各工具的用量数据分散，无法汇总查看
- 没有预算预警，超额使用后才发现
- 现有方案（Langfuse、Helicone）需 SDK 埋点或自部署复杂

本项目提供代理模式的 Token 监控：改环境变量即可接入，不装 SDK。

---

## 2. 方案选型

采用 Langfuse（MIT）+ 自研 Go 代理网关 + 自研 C++ 分析引擎的融合架构：

| 层面 | 方案 | 原因 |
|------|------|------|
| 用户系统 | Langfuse 自带 | 注册/登录/API Key/项目管理已完整 |
| 数据存储 | Langfuse (ClickHouse + PostgreSQL) | 成熟的事件模型和 OLAP 查询 |
| 代理网关 | **自研 Go** | 二者均无 Go 实现；标准库即可完成 |
| 分析引擎 | **自研 C++** | 离线批处理，ClickHouse C++ 客户端直连 |
| 前端 | Fork Langfuse 后定制 | 只改表层 CSS + 新增 Token 面板 |
| 许可证 | Langfuse MIT + Helicone Apache 2.0 | 允许任意使用、修改、分发 |

---

## 3. 技术验证

| 验证项 | 方法 | 结果 |
|------|------|:--:|
| Langfuse 本地部署 | `docker compose up -d` 6 服务 | ✅ |
| 数据链路 | Python SDK trace → ClickHouse → Web UI | ✅ |
| Go 代理骨架 | `go build ./cmd/proxy/...` | ✅ |
| 腾讯云 Docker | compose 插件 + 镜像加速器 | ✅ |
| 腾讯云 Langfuse 部署 | 6 容器 healthy，v3.224.1 | ✅ |
| 阿里云→腾讯云 SSH | `ssh -i ~/.ssh/tencent_cloud` | ✅ |

---

## 4. 基础设施

| 资源 | 用途 |
|------|------|
| 阿里云 2C2G 40GB | Nginx + Go 代理网关 + Go 管理后台 + Webhook |
| 腾讯云 4C4G 40GB | Langfuse (6 容器) + SmartKB + C++ 分析引擎 |
| 域名 oxelia51.com | 已有，Let's Encrypt 自动续期 |
| GitHub Actions | CI/CD（免费额度 2000 分钟/月） |
| GitHub Container Registry | 镜像存储（备选） |

---

## 5. 数据采集

API 代理模式。用户将 `ANTHROPIC_BASE_URL` 或 `OPENAI_BASE_URL` 指向代理地址：

1. 从请求头提取 `X-Project-ID`（项目标识）和 `X-Session-ID`（会话标识）
2. 解析请求体中 `model` 字段
3. 转发到上游 LLM
4. 接收响应：JSON 直接解析 `usage`；SSE 流从最后 chunk 提取
5. `go recorder.Record()` 异步写 ClickHouse
6. 原样返回响应

用户改动量：一行环境变量。

---

## 6. 风险

| 风险 | 缓解 |
|------|------|
| Langfuse 版本升级导致 Fork 冲突 | 只改前端表层，`git rebase upstream/main` |
| ClickHouse 运维 | Docker Compose 托管，volume 持久化 |
| 代理增加延迟 | Go 同机房转发 < 5ms，上游 LLM 延迟 100-500ms |
| SSE Token 解析丢数据 | 多模型充分测试，累积计数兜底 |
| 上游 API 格式变更 | Adapter 模式隔离，变更只影响一个文件 |

---

## 7. 结论

技术验证全部通过，基础设施就绪，无阻断性风险。进入实现阶段。
