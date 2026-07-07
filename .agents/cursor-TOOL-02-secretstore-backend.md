---
from: Codex (Architecture Agent)
to: Cursor (Backend Agent)
task: TOOL-02
status: ready
date: 2026-07-08
depends_on: none
blocks: TOOL-03, TOOL-04
precondition: REF-01 (DormGuard Go 重构) 已完成
---

# TOOL-02：SecretStore 后端开发

## 背景

SecretStore 是 Oxelia51 平台的新在线工具——加密存储用户 API 密钥、账户密码、
网址等敏感信息。支持自定义字段与自定义组合，提供常见场景模板。

完整设计文档：[docs/tools/secretstore-design.md](../../docs/tools/secretstore-design.md)

## 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 后端 | Go + Gin | 与 Oxelia51 同栈 |
| 数据库 | PostgreSQL（Oxelia51 平台共用） | 新建 schema `secretstore` |
| 加密 | Go crypto/aes | AES-256-GCM |

## 数据模型

```
User (Oxelia51) → Vault (一对一) → Entry (一对多) → EntryField (一对多)
```

加密策略：`EntryField.value` 写入前 AES-256-GCM 加密。
密钥从环境变量 `SECRETSTORE_ENCRYPTION_KEY` 读取（32 字节 hex）。
用户通过 Oxelia51 JWT 认证后直接访问，无需二次解锁。

## PostgreSQL Schema

在 Oxelia51 平台数据库中新建 `secretstore` schema：

```sql
CREATE SCHEMA IF NOT EXISTS secretstore;

CREATE TABLE secretstore.vaults (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE secretstore.entries (
    id BIGSERIAL PRIMARY KEY,
    vault_id BIGINT NOT NULL REFERENCES secretstore.vaults(id),
    title TEXT NOT NULL,
    template_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE secretstore.entry_fields (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES secretstore.entries(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_value BYTEA NOT NULL,  -- AES-256-GCM encrypted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE secretstore.templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE secretstore.template_fields (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES secretstore.templates(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',
    sort_order INT DEFAULT 0
);

CREATE TABLE secretstore.combos (
    id BIGSERIAL PRIMARY KEY,
    vault_id BIGINT NOT NULL REFERENCES secretstore.vaults(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE secretstore.combo_entries (
    combo_id BIGINT NOT NULL REFERENCES secretstore.combos(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL REFERENCES secretstore.entries(id) ON DELETE CASCADE,
    PRIMARY KEY (combo_id, entry_id)
);
```

## 8 种标准模板

模板数据通过迁移脚本预填充：

1. API 配置：API Key、Base URL、Model Name、Org ID
2. 登录凭证：Website、URL、Username、Password、2FA Secret
3. 数据库连接：Type、Host、Port、Username、Password、DB Name
4. 服务器 SSH：Host、Port、Username、Auth Type、Password/Key
5. 云服务密钥：Provider、Access Key、Secret Key、Region
6. 邮箱账户：Email、Password、SMTP Server、Port、SSL
7. WiFi 网络：SSID、Password、Security Type
8. 自定义：用户自由定义所有字段

## 核心 API

端口：`8001`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/entries | 列出所有 Entry |
| POST | /api/entries | 创建 Entry |
| GET | /api/entries/:id | 获取 Entry（含解密字段）|
| PATCH | /api/entries/:id | 更新 Entry |
| DELETE | /api/entries/:id | 删除 Entry |
| GET | /api/templates | 模板列表 |
| GET | /api/combos | Combo 列表 |
| POST | /api/combos | 创建 Combo |
| DELETE | /api/combos/:id | 删除 Combo |
| POST | /api/vault/export | 加密导出 |

## 环境变量

| 变量 | 说明 |
|------|------|
| SECRETSTORE_ENCRYPTION_KEY | AES-256-GCM 32 字节 hex 密钥 |
| DATABASE_URL | Oxelia51 PostgreSQL 连接字符串 |
| SECRETSTORE_PORT | 服务端口（默认 8001） |
| OXELIA_GATEWAY_MODE | 信任网关身份头 |

## 项目结构建议

```
SecretStore/
├── cmd/server/main.go
├── internal/
│   ├── handler/       # HTTP handlers
│   ├── model/         # 数据模型
│   ├── db/            # PostgreSQL 访问
│   ├── crypto/        # AES-256-GCM 加解密
│   └── config/        # 配置
├── migrations/        # PostgreSQL 迁移
├── go.mod
├── go.sum
├── .env.example
└── oxelia51.tool.json
```

## oxelia51.tool.json

```json
{
  "slug": "secretstore",
  "name": "SecretStore",
  "description": "加密存储 API 密钥、密码等敏感信息",
  "online_capable": true,
  "user_accessible": true,
  "status": "enabled",
  "port": 8001,
  "release_url": "https://github.com/XiaoleC05/Oxelia51/releases"
}
```

## 接受标准

- [ ] `go build ./...` 通过
- [ ] `secretstore` schema 迁移成功
- [ ] 8 种模板预填充
- [ ] AES-256-GCM 加解密正确
- [ ] 所有 CRUD API 可用
- [ ] JWT 认证（通过 OXELIA_GATEWAY_MODE 信任网关）
- [ ] `oxelia51.tool.json` 就绪

## 仓库

新建仓库 github.com/XiaoleC05/SecretStore，或放在 Oxelia51 monorepo 中。
架构建议：独立仓库，与 DormGuard 同模式。
*** End of File
