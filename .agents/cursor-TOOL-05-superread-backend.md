---
from: Codex (Architecture Agent)
to: Cursor (Backend Agent)
task: TOOL-05-1
status: ready
date: 2026-07-09
depends_on: none
blocks: TOOL-05-2 (Hermes), TOOL-05-3 (注册)
---

---
from: Codex (Architecture Agent)
to: Cursor (Backend Agent)
task: TOOL-05-1
status: ready
date: 2026-07-09
depends_on: none
blocks: TOOL-05-2 (Hermes), TOOL-05-3 (注册)
---

> **Cursor 职责边界（AGENTS.md §4.2）**
> - ✅ 可修改：后端源代码、后端配置、后端测试、后端文档
> - ❌ 不得修改：前端、UI、CSS、项目架构、数据库设计、API 规范、CI/CD 工作流
> - ⚠️ 上报：数据库模式变更、API 变更、框架变更、项目结构变更、第三方依赖变更
> - **完成标准**：代码编译通过、逻辑正确、现有功能不受影响、无未完成代码

# TOOL-05-1：SuperRead 后端 API


## 背景

SuperRead 是 Oxelia51 平台的在线工具——RSS 订阅聚合 + AI 简报生成。
用户添加 RSS 源，系统定时抓取新文章，用大模型浓缩为单句摘要，
每日汇总为简报。桌面版使用 SQLite，在线版复用 Oxelia51 PostgreSQL。

仓库：github.com/XiaoleC05/SuperRead（目前仅有 README + manifest，需从零搭建）

## 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 后端 | Go + Gin | 与 Oxelia51 / DormGuard 同栈 |
| 数据库 | PostgreSQL（Oxelia51 平台共用） | schema `superread` |
| RSS 解析 | gofeed | 成熟、支持 Atom/RSS/JSON Feed |
| AI 摘要 | 用户提供 API Key（OpenAI 兼容） | 桌面版同样需要用户 Key |
| 定时任务 | Go cron（robfig/cron） | 轻量，无外部依赖 |

## 数据库 Schema

在 Oxelia51 PostgreSQL 中新建 schema `superread`：

```sql
CREATE SCHEMA IF NOT EXISTS superread;

CREATE TABLE superread.feeds (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    feed_url TEXT NOT NULL,
    site_url TEXT DEFAULT '',
    last_fetched_at TIMESTAMPTZ,
    fetch_error TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feed_url)
);

CREATE TABLE superread.articles (
    id BIGSERIAL PRIMARY KEY,
    feed_id BIGINT NOT NULL REFERENCES superread.feeds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    author TEXT DEFAULT '',
    published_at TIMESTAMPTZ,
    content_text TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    tag TEXT DEFAULT '',
    guid TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(feed_id, guid)
);

CREATE TABLE superread.user_settings (
    user_id BIGINT PRIMARY KEY,
    api_key TEXT DEFAULT '',
    api_base TEXT DEFAULT '',
    model TEXT DEFAULT 'gpt-4o-mini',
    fetch_interval_min INT DEFAULT 30,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 核心 API

端口：`8002`

### Feed 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/feeds | 用户订阅列表 |
| POST | /api/feeds | 添加 RSS 源 |
| DELETE | /api/feeds/:id | 删除订阅 |
| POST | /api/feeds/import | OPML 批量导入 |
| POST | /api/feeds/:id/fetch | 手动抓取单个源 |

### 文章

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/articles | 文章列表（按时间倒序） |
| GET | /api/articles?feed_id=:id | 按源筛选 |
| GET | /api/articles?starred=true | 星标文章 |
| GET | /api/articles?tag=:tag | 按标签筛选 |
| PATCH | /api/articles/:id | 更新已读/星标/标签 |
| GET | /api/daily-brief | 当日简报 |

### 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/settings | 获取用户设置 |
| PUT | /api/settings | 更新 API Key / 模型 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 服务状态 |

## 定时任务

使用 `robfig/cron` 实现：

- **RSS 抓取**：默认每 30 分钟遍历所有用户的 feed，检测新文章
- **AI 摘要**：新文章入库后，调用用户配置的 API 生成摘要（异步，避免阻塞）
- **每日简报**：每日定时汇总所有源的新文章

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接 | — |
| SUPERREAD_PORT | 服务端口 | 8002 |
| OXELIA_GATEWAY_MODE | 信任网关身份头 | false |

## 项目结构

```
SuperRead/
├── cmd/server/main.go
├── internal/
│   ├── handler/    # HTTP handlers
│   ├── model/      # 数据模型
│   ├── db/         # PostgreSQL
│   ├── fetcher/    # RSS 抓取 (gofeed)
│   ├── summarizer/ # AI 摘要 (OpenAI 兼容)
│   └── cron/       # 定时任务
├── migrations/
├── go.mod / go.sum
├── .env.example
├── oxelia51.tool.json
└── README.md
```

## oxelia51.tool.json

```json
{
  "slug": "superread",
  "name": "SuperRead",
  "description": "RSS 订阅与 AI 简报",
  "online_capable": true,
  "github_repo": "XiaoleC05/SuperRead",
  "release_url": "https://github.com/XiaoleC05/SuperRead/releases"
}
```

## 接受标准

- [ ] `go build ./...` 通过
- [ ] `superread` schema 迁移成功
- [ ] RSS 源添加 + 自动抓取
- [ ] OPML 导入
- [ ] AI 摘要生成（OpenAI 兼容 API）
- [ ] 每日简报 API
- [ ] 文章已读/星标/标签
- [ ] OXELIA_GATEWAY_MODE 网关身份信任
- [ ] oxelia51.tool.json 就绪（已存在，无需修改）

## 分支

在 SuperRead 仓库创建 `codex/TOOL-05-superread-backend` 进行开发。
*** End of File
