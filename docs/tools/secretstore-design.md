# SecretStore 设计文档

版本：v1.0-draft | 日期：2026-07-08
状态：设计中，待审核后开发

---

## 1. 产品定位

加密存储用户 API 密钥、账户密码、网址等敏感信息。支持自定义字段与自定义组合，提供常见场景模板。通过 Oxelia51 平台统一访问。

## 2. 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 后端 | Go + Gin | 与 Oxelia51 同栈，内存 50-80MB |
| 数据库 | PostgreSQL | 复用 Oxelia51 平台数据库，schema 隔离 |
| 加密 | Go crypto/aes | AES-256-GCM，密钥从服务器环境变量读取 |
| 前端 | React | 由 Oxelia51 统一渲染，gateway proxy 访问 |

## 3. 数据模型

User (Oxelia51) -> Vault (一对一) -> Entry (一对多) -> EntryField (一对多)

加密策略：EntryField.value 写入前 AES-256-GCM 加密，密钥从服务器环境变量 SECRETSTORE_ENCRYPTION_KEY 读取（32 字节 hex）。用户通过 Oxelia51 JWT 认证后直接访问，无需二次解锁。

## 4. 标准模板

1. API 配置：API Key、Base URL、Model Name、Org ID
2. 登录凭证：Website、URL、Username、Password、2FA Secret
3. 数据库连接：Type、Host、Port、Username、Password、DB Name
4. 服务器 SSH：Host、Port、Username、Auth Type、Password/Key
5. 云服务密钥：Provider、Access Key、Secret Key、Region
6. 邮箱账户：Email、Password、SMTP Server、Port、SSL
7. WiFi 网络：SSID、Password、Security Type
8. 自定义：用户自由定义所有字段

## 5. 自定义组合

用户从已有 Entry 中选择若干条组装为 Combo。
例如："GPT-4 开发环境" = {OpenAI Key} + {Base URL}

## 6. 核心 API

- 无需解锁端点——JWT 认证后直接访问数据
- CRUD /api/entries — Entry 管理
- GET /api/templates — 模板列表
- CRUD /api/combos — 组合管理
- POST /api/vault/export — 加密导出


## 7. 安全

- 加密密钥存服务器 .env
- AES-256-GCM 加密所有敏感字段



## 8. 数据库 Schema

复用 Oxelia51 PostgreSQL，新建 schema secretstore：
vaults、entries、entry_fields、templates、template_fields、combos、combo_entries

## 9. Oxelia51 接入

- slug: secretstore
- 代理: /api/tools/secretstore/proxy/*path
- 端口: 8001
- 前端: frontend/src/tools/secretstore/SecretStoreTool.jsx
