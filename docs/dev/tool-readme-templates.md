# 6 个工具仓库 README 模板

> 以下为各工具仓库 README.md 的中文统一模板。请复制到对应仓库的 README.md，替换 `{...}` 占位符。

---

## SuperRead

```markdown
# SuperRead

RSS 订阅管理 + AI 每日简报生成。

## 功能

- RSS 源订阅管理（添加/删除/导入 OPML）
- 可配置的定时抓取（5–1440 分钟）
- AI 每日摘要（支持 OpenAI 兼容 API）
- 文章全文检索（pgvector 向量化）

## 技术栈

Go + Gin + PostgreSQL + pgvector + Redis

## 本地运行

cp .env.example .env
go run ./cmd/server/

## 部署

由 Oxelia51 平台自动部署，详见 [部署文档](https://github.com/XiaoleC05/Oxelia51/blob/master/docs/dev/deployment.md)。
```

## DormGuard

```markdown
# DormGuard

宿舍电费监控 + QQ 机器人推送。

## 功能

- 定时爬取电费余额
- 低于阈值自动告警
- QQ 机器人实时推送
- 管理后台配置爬虫参数

## 技术栈

Go + Gin + MySQL + NapCat QQ Bot

## 本地运行

cp .env.example .env
go run ./cmd/server/

## 部署

由 Oxelia51 平台自动部署，详见 [部署文档](https://github.com/XiaoleC05/Oxelia51/blob/master/docs/dev/deployment.md)。
```

## AIHelper

```markdown
# AIHelper

提示词管理与增强工具。

## 功能

- 提示词模板管理（创建/编辑/删除）
- 模板变量替换
- 版本历史与回滚
- 一键复制到剪贴板

## 技术栈

Go + Gin + PostgreSQL

## 本地运行

cp .env.example .env
go run ./cmd/server/

## 部署

由 Oxelia51 平台自动部署，详见 [部署文档](https://github.com/XiaoleC05/Oxelia51/blob/master/docs/dev/deployment.md)。
```

## AgentCanvas

```markdown
# AgentCanvas

Agent 执行流程可视化画布。

## 功能

- Agent 执行节点图可视化
- 拖拽编排执行流程
- 实时状态查看
- 执行历史回放

## 技术栈

Go + Gin

## 本地运行

cp .env.example .env
go run ./cmd/server/

## 部署

由 Oxelia51 平台自动部署，详见 [部署文档](https://github.com/XiaoleC05/Oxelia51/blob/master/docs/dev/deployment.md)。
```

## SecretStore

```markdown
# SecretStore

AES-256-GCM 加密保险箱。

## 功能

- 密码/API Key/凭证加密存储
- 7 种凭证模板（服务器/数据库/模型厂商等）
- 一键复制/显示/隐藏
- 模板化管理与搜索

## 技术栈

Go + Gin + PostgreSQL + AES-256-GCM

## 本地运行

cp .env.example .env
go run ./cmd/server/

## 部署

由 Oxelia51 平台自动部署，详见 [部署文档](https://github.com/XiaoleC05/Oxelia51/blob/master/docs/dev/deployment.md)。
```

## SmartKB

```markdown
# SmartKB

基于 pgvector 的知识库检索。

## 功能

- 文档上传与自动分段
- pgvector 向量化索引
- 语义搜索与相似度排序
- RAG（检索增强生成）问答

## 技术栈

Go + Gin + PostgreSQL + pgvector

## 本地运行

cp .env.example .env
go run ./cmd/server/

## 部署

由 Oxelia51 平台自动部署，详见 [部署文档](https://github.com/XiaoleC05/Oxelia51/blob/master/docs/dev/deployment.md)。
```