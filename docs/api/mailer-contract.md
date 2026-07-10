# 邮件服务契约

**版本**：v1.1  
**状态**：已冻结（2026-07-05 修订）  
**日期**：2026-07-05

---

## 1. 选型

| 环境 | 方案 |
|------|------|
| **生产** | **阿里云邮件推送** |
| **本地开发** | QQ 邮箱 SMTP（`.env` 切换） |

## 2. Token 规范（审查 M5 — 确定性）

| 项 | 值 |
|----|-----|
| 存储 | **Redis**（key: `email_token:<type>:<token>`） |
| 有效期 | **24 小时** |
| 使用次数 | **单次**；成功后删除 |
| 过期错误码 | `TOKEN_EXPIRED`（`400`） |
| 无效错误码 | `TOKEN_INVALID`（`400`） |

类型：`verify` | `reset_password`

## 3. 限流（独立计数，审查 C2）

| 操作 | Redis key 前缀 | 限制 |
|------|----------------|------|
| 注册 | `rl:register:ip:` | 同 IP ≤3/小时 |
| 重发验证 | `rl:resend:email:` | 同邮箱 ≤1/天 |
| 忘记密码 | `rl:forgot:email:` | 同邮箱 ≤1/天 |
| 登录失败 | `rl:login:ip:` | 同 IP ≤10/15min |

三类邮件限流**互不共用**计数器。

## 4. 环境变量

见 v1.0；补充：

```env
EMAIL_TOKEN_TTL=24h
APP_PUBLIC_URL=http://localhost:5173   # 开发
```

## 5. 安全

- `forgot-password` 统一 `200`
- 日志不打印 token 明文
- `email` UNIQUE（ADR-005 / platform-api §3.1）
