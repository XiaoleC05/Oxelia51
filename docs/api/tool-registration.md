# 工具注册与 manifest 契约

**版本**：v1.1  
**状态**：已冻结（2026-07-05 修订）  
**日期**：2026-07-05

---

## 1. 原则

- 各工具仓库根目录维护 **`oxelia51.tool.json`**。
- `POST /api/admin/tools/scan-local` 扫描 `D:\07_Projects\code`。
- 管理者可在后台覆盖部分字段。

## 2. 字段命名修订（审查 C1）

| 旧名（v1.0，废弃） | 新名（v1.1） | 语义 |
|-------------------|--------------|------|
| `visitor_visible` | **`user_accessible`** | 已登录**普通用户**是否可使用该在线工具 |

「访客」指未登录用户，本来就不能用在线工具；本字段只约束 `role=user`。

## 3. manifest：`oxelia51.tool.json`

### 3.1 在线工具（必填）

```json
{
  "slug": "dormguard",
  "name": "DormGuard",
  "description": "西华大学宿舍电费余额监控",
  "online_capable": true,
  "github_repo": "XiaoleC05/DormGuard",
  "release_url": "https://github.com/XiaoleC05/DormGuard/releases"
}
```

### 3.2 仅作品集 / 非在线（如 XiaoleC05.github.io）

```json
{
  "slug": "xiaolec05-github-io",
  "name": "XiaoleC05.github.io",
  "description": "个人网站与作品集",
  "online_capable": false,
  "github_repo": "XiaoleC05/XiaoleC05.github.io",
  "release_url": ""
}
```

### 3.3 字段与默认值

| 字段 | 必填 | 缺失时默认 |
|------|------|------------|
| `slug` | 是 | 扫描失败，跳过并告警 |
| `name` | 是 | 用目录名 |
| `description` | 是 | 空字符串 |
| `online_capable` | 否 | **`false`** |
| `github_repo` | 否 | 空 |
| `release_url` | 否 | 空 |

### 3.4 仅 DB / 部署（不在 manifest）

| 字段 | 默认 | 说明 |
|------|------|------|
| `user_accessible` | `false` | 管理者后台开关 |
| `status` | `enabled` | `enabled` / `disabled` |
| `internal_api_base` | `''` | 网关转发，`.env` 可覆盖 |

## 4. 数据库

### 4.1 `tools` 表（在线工具）

```sql
slug              VARCHAR(64)  NOT NULL UNIQUE,
user_accessible   BOOLEAN      NOT NULL DEFAULT FALSE,
online_capable    BOOLEAN      NOT NULL DEFAULT FALSE,
status            VARCHAR(16)  NOT NULL DEFAULT 'enabled',
internal_api_base VARCHAR(256) DEFAULT '',
github_repo       VARCHAR(128) DEFAULT '',
release_url       VARCHAR(512) DEFAULT '',
manifest_path     VARCHAR(512) DEFAULT '',
description_override TEXT      DEFAULT NULL
```

### 4.2 `portfolio_items` 表（独立，审查 M8）

作品集与在线工具**分表**；扫描时每个 `code` 子目录写一条 portfolio，在线工具可双写关联 `slug`。

```sql
slug              VARCHAR(64)  PRIMARY KEY,
name              VARCHAR(128) NOT NULL,
description       TEXT         NOT NULL DEFAULT '',
github_repo       VARCHAR(128) DEFAULT '',
source_dir        VARCHAR(512) DEFAULT '',  -- 本地路径
name_override     VARCHAR(128) DEFAULT NULL,
description_override TEXT      DEFAULT NULL,
linked_tool_slug  VARCHAR(64)  DEFAULT NULL  -- 可选，关联 tools.slug
```

- `GET /api/admin/portfolio` → `portfolio_items`
- 工具目录 `GET /api/tools` → 仅 `online_capable=true` 且存在于 `tools` 表
- 作品集页 → `portfolio_items`（含 Oxelia51、github.io 等无在线能力项）

## 5. 扫描规则

1. 遍历 `code` 一级子目录。
2. 有 `oxelia51.tool.json` → 解析；无则仅用目录名写入 `portfolio_items`。
3. `online_capable=true` → upsert `tools`；**不自动改** `user_accessible`。
4. slug 冲突 → 报错。

## 6. 整工具开关与徽章

| `status` | `user_accessible` | 普通用户 | `oxelia51` | 徽章 |
|----------|-------------------|----------|------------|------|
| `enabled` | `true` | 可用 | 可用 | 已开放 |
| `enabled` | `false` | 不可用 | 可用 | 暂未开放 |
| `disabled` | * | 不可用 | 不可用 | 已下线 |

## 7. 阶段 1 DormGuard

`online_capable=true`，`user_accessible=false`，`status=enabled`（ADR-007）。
