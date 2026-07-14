# API 网关契约

**版本**：v1.1  
**状态**：已冻结（2026-07-05 修订）  
**日期**：2026-07-05

---

## 1. 目标

平台后端将前端对在线工具的请求转发至各工具内网 API（ADR-002）。用户浏览器不直连工具端口。

## 2. 路由

```
/api/tools/:slug/proxy/*path
```

示例：

| 前端请求 | 上游（`tools.internal_api_base`） |
|----------|-------------------------------------|
| `GET /api/tools/dormguard/proxy/api/balance` | `GET http://127.0.0.1:8000/api/balance` |

## 3. 错误码

| 场景 | HTTP | `code` |
|------|------|--------|
| 未登录 | 401 | `UNAUTHORIZED` |
| 未验证邮箱 | 403 | `EMAIL_NOT_VERIFIED` |
| slug 不存在 | **404** | `TOOL_NOT_FOUND` |
| 普通用户访问 `user_accessible=false` | 403 | `TOOL_NOT_ACCESSIBLE` |
| `status=disabled`（所有角色） | **503** | `TOOL_OFFLINE` |
| `online_capable=false` | 404 | `TOOL_NOT_ONLINE` |
| 上游不可达 | **502** | `UPSTREAM_UNAVAILABLE` |
| 上游超时 | 504 | `UPSTREAM_TIMEOUT` |

**管理者 `oxelia51`**：豁免 `user_accessible` 检查；**不豁免** `status=disabled` 与 `online_capable=false`（避免访问已下线或未接入工具）。

## 4. 鉴权规则

| 调用者 | 条件 |
|--------|------|
| 未登录 | 拒绝 `401` |
| 未验证邮箱 | 拒绝 `403` |
| `user` | `user_accessible=true` 且 `status=enabled` 且 `online_capable=true` |
| `admin` | `status=enabled` 且 `online_capable=true`（无视 `user_accessible`） |

## 5. 请求头（转发至工具）

```
X-Oxelia51-User-Id: <id>
X-Oxelia51-Username: <username>
X-Oxelia51-Role: admin|user
X-Oxelia51-Request-Id: <uuid>
```

- 不转发客户端 `Authorization`。
- 工具侧在 `OXELIA_GATEWAY_MODE=true` 时信任上述头（见 ADR-007）；请求须来自 loopback/内网。

## 6. 超时与限制

- 默认上游超时：**30s**
- 请求体默认上限：**10MB**
- `internal_api_base` 仅存服务端，不返回前端

## 7. 阶段 1 与现网（ADR-006）

- 公网 Nginx `/api/` 仍指向 DormGuard `:8000`。
- 平台网关跑在 `:8080`，经 `127.0.0.1:8000` loopback 转发 DormGuard，**不修改**现网 Nginx。
