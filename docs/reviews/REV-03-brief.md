# REV-03：GW-01 网关 PR 审查简报

**任务 ID**：REV-03
**角色**：Codex + DeepSeek V4 Pro（只读审查，不写代码）
**日期**：2026-07-05
**基线**：契约 v1.1（已冻结）
**审查目标**：GW-01 API 网关实现 PR

---

## 1. 审查目标

验证 Cursor 主笔提交的 **GW-01 网关实现**是否：

1. **符合契约** `docs/api/gateway-contract.md` v1.1（路由、错误码、鉴权规则、转发头、超时与限制）；
2. **实现正确**（边界、并发、错误路径、资源释放）；
3. **测试充分**（覆盖关键路径与失败场景）；
4. **安全无缺口**（鉴权绕过、头注入、SSRF、体大小限制）；
5. **未越界**（不修改 `docs/api/*` 契约文本，不改非网关模块）。

输出：**闭环结论**（通过 / 有条件通过 / 不通过）+ 问题清单（按 P0～P3 分级）。

---

## 2. 必读文档（按顺序）

| 序号 | 路径 | 用途 |
|------|------|------|
| 1 | `docs/api/gateway-contract.md` | 网关契约 v1.1（路由、错误码、转发头、超时） |
| 2 | `docs/adr/ADR-002-平台API网关模式.md` | 网关架构决策 |
| 3 | `docs/adr/ADR-007-DormGuard内网化与数据库边界.md` | `OXELIA_GATEWAY_MODE`、loopback 信任 |
| 4 | `docs/06-多Agent任务板.md` | GW-01 任务定义与状态 |

---

## 3. 审查范围（代码）

### 3.1 涉及 commit（按时间倒序）

| commit | 说明 |
|--------|------|
| `fde17c8` | fix(gateway): strip client IP forwarding headers before proxying to upstream |
| `f0d958f` | fix: improve JWT claims parsing and gateway proxy auth errors |
| `8749e4c` | fix: revoke refresh token on logout and cap gateway response size |
| `8b4ef65` | feat: implement v1.1 MVP platform backend, gateway, and frontend |

### 3.2 涉及文件

| 文件 | 审查重点 |
|------|----------|
| `backend/internal/gateway/proxy.go` | 主代理逻辑、`copyHeaders`、`injectGatewayHeaders`、超时与体限制、错误码 |
| `backend/internal/gateway/access.go` | `CheckAccess` 鉴权规则（admin 豁免、status=disabled、online_capable） |
| `backend/internal/gateway/resolver.go` | `ResolveInternalAPIBase` 内网地址解析 |
| `backend/internal/gateway/proxy_test.go` | 单元测试覆盖 |
| `backend/internal/gateway/access_test.go` | 鉴权测试覆盖 |

获取完整 diff：

```bash
git diff 8b4ef65^..fde17c8 -- backend/internal/gateway/
```

---

## 4. 逐条验收清单

### P0（阻断级 — 必须通过）

| 编号 | 审查项 | 契约依据 | 验收要点 |
|------|--------|----------|----------|
| G1 | 路由 `/api/tools/:slug/proxy/*path` | §2 | 路径拼接正确，`proxyPath` 缺失时回退 `/` |
| G2 | 错误码与 HTTP 状态 | §3 | 401/403/404/503/502/504 与 `code` 字段一一对应 |
| G3 | 鉴权规则 | §4 | admin 豁免 `user_accessible` 但**不豁免** `status=disabled` / `online_capable=false` |
| G4 | 转发头 | §5 | 不转发客户端 `Authorization`；注入 `X-Oxelia51-User-Id/Username/Role/Request-Id` |
| G5 | IP 转发头剥离（fde17c8 新增） | §5 实施层 | `copyHeaders` 剥离 `X-Real-IP` / `X-Forwarded-*` / `X-Client-IP` / `Forwarded`，防止上游启用 proxy-headers 后 loopback 信任失效 |

### P1（重要）

| 编号 | 审查项 | 契约依据 | 验收要点 |
|------|--------|----------|----------|
| G6 | 上游超时 30s | §6 | `defaultUpstreamTimeout=30s`，可配置覆盖 |
| G7 | 请求体上限 10MB | §6 | `defaultMaxBodyBytes=10<<20`，`http.MaxBytesReader` 生效 |
| G8 | 响应体上限 | §6 | `readLimitedBody` 防止上游返回过大响应耗尽内存 |
| G9 | `internal_api_base` 不返回前端 | §6 | 该字段不出现在任何前端可见响应 |
| G10 | 跳转策略 | — | `CheckRedirect: http.ErrUseLastResponse` 不自动跟随上游重定向 |

### P2（重要，可后补但应审查）

| 编号 | 审查项 | 验收要点 |
|------|--------|----------|
| G11 | 并发安全 | `http.Client` 复用是否安全；`Handler` 字段是否只读 |
| G12 | 资源释放 | `resp.Body.Close()` defer 是否覆盖所有路径；`context.cancel` 是否泄漏 |
| G13 | hop-by-hop 头 | `isHopByHop` 清单是否覆盖 RFC 7230 §6.1 |
| G14 | Host 头 | 上游请求 Host 是否为目标内网地址（127.0.0.1:8000），非公网 Host 透传 |
| G15 | 测试覆盖 | `proxy_test.go` 覆盖 copyHeaders 剥离、响应方向保留、大小写；`access_test.go` 覆盖 6 种角色×状态组合 |

### P3（建议）

| 编号 | 审查项 | 验收要点 |
|------|--------|----------|
| G16 | 日志与可观测性 | `X-Oxelia51-Request-Id` 是否可用于链路追踪；错误日志是否含足够上下文 |
| G17 | 性能 | map 查询开销可忽略；是否有不必要的 header 复制 |
| G18 | 可维护性 | `clientIPForwardHeaders` 集中定义且注释说明原因 |

---

## 5. 安全专项检查

| 检查项 | 风险 |
|--------|------|
| S1 | **鉴权绕过**：是否存在不经过 `CheckAccess` 的路径 |
| S2 | **头注入**：`X-Oxelia51-*` 头值是否来自服务端可信源（JWT claims），而非客户端入参 |
| S3 | **SSRF**：`ResolveInternalAPIBase` 是否能被前端操纵指向任意主机（应只允许 127.0.0.1 / 内网） |
| S4 | **体大小 DoS**：请求与响应两侧是否都有上限 |
| S5 | **超时 DoS**：上游慢响应是否被 30s 超时切断 |
| S6 | **IP 头伪造**：前端伪造 `X-Forwarded-For` 是否会被透传到上游（fde17c8 后应被剥离） |
| S7 | **Authorization 泄漏**：客户端 Bearer token 是否会泄漏到上游工具 |

---

## 6. 输出格式（请严格遵循）

```markdown
# REV-03 网关 PR 审查报告

**结论**：通过 | 有条件通过 | 不通过
**审查日期**：
**基线**：契约 v1.1
**审查 commit 范围**：8b4ef65^..fde17c8

## 逐条验收（G1～G18）

| 编号 | 状态 | 证据（代码行/文件§） | 备注 |

## 安全专项（S1～S7）

| 检查项 | 通过 | 说明 |

## 残余问题（如有）

| 优先级 | 问题 | 建议修复 |

## 实施放行建议

- GW-01 是否可标记为最终 done：是/否
- 是否需 v1.2 契约修订：是/否
```

---

## 7. 约束

- **只读**：不修改仓库、不生成实现代码、不直接 push。
- 若发现 P0 级问题，必须标为 **不通过** 并指明文件与行号。
- 若仅存在 P3 级瑕疵，可 **有条件通过** 并列出待办。
- 审查完成后，结论同步到 `docs/06-多Agent任务板.md` 的 REV-03 状态字段。

---

## 8. 提交说明（给审查员）

Cursor 主笔已完成 GW-01 全部实现，包含 4 个 commit。最新 commit `fde17c8` 是对 IP 转发头剥离的加固，属于实施层增强，**未变更契约文本**。

本地已执行 `go test ./internal/gateway/ -v` 全部通过，`go vet ./...` + `go build ./...` 无输出。

请独立复核，勿仅依赖测试通过即放行；须打开 §2 所列契约文档逐项比对实现。
