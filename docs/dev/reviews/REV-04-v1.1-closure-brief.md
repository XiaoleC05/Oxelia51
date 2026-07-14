# REV-04：契约 v1.1 闭环审查简报

**任务 ID**：REV-04  
**角色**：Codex + DeepSeek V4 Pro（只读审查，不写代码）  
**日期**：2026-07-05  
**基线**：Codex v1.0 审查报告 16 项建议  
**修订版**：Oxelia51 契约 **v1.1**

---

## 1. 审查目标

验证 Cursor 主笔提交的 **v1.1 修订**是否：

1. **完整覆盖** v1.0 审查报告中的 16 条建议（P0～P3）；
2. **文档间自洽**（无新旧字段混用、无限流矛盾）；
3. **可实施**（阶段 1 不因 Nginx/认证/DB 再次阻塞）；
4. 无**新增矛盾**（修订本身不引入新问题）。

输出：**闭环结论**（通过 / 有条件通过 / 不通过）+ 残余问题清单（若有）。

---

## 2. 必读文档（按顺序）

| 序号 | 路径 | 用途 |
|------|------|------|
| 1 | `docs/08-契约审查修订记录.md` | Cursor 声称的逐条处理对照 |
| 2 | `docs/07-需求确认摘要.md` | 需求 v1.1 总表 |
| 3 | `docs/adr/ADR-005-用户模型与邮箱验证.md` | 用户、限流、字段重命名 |
| 4 | `docs/adr/ADR-006-现网首页迁移策略.md` | Nginx 共存、阶段划分 |
| 5 | `docs/adr/ADR-007-DormGuard内网化与数据库边界.md` | DormGuard 认证、DB、阶段 1 状态 |
| 6 | `docs/api/platform-api.md` | REST、JWT、徽章、管理 API |
| 7 | `docs/api/gateway-contract.md` | 网关鉴权、错误码 |
| 8 | `docs/api/tool-registration.md` | manifest、`user_accessible`、`portfolio_items` |
| 9 | `docs/api/mailer-contract.md` | Token、限流独立计数 |
| 10 | `docs/06-多Agent任务板.md` | 任务与冻结状态 |

v1.0 审查报告（对话上下文或项目记录）作为对照基线。

---

## 3. 逐条验收清单（16 项）

审查员须对每一项给出：**已闭环 / 部分闭环 / 未闭环**，并引用 v1.1 文档章节号。

### P0（阻断级）

| 原编号 | 原问题 | v1.1 预期修复位置 | 验收要点 |
|--------|--------|-------------------|----------|
| C1 | `visitor_visible` 语义错误 | ADR-005、tool-registration §2 | 全文无 `visitor_visible` 残留；`user_accessible` 定义清晰 |
| D1 | Nginx `/api/` 冲突 | ADR-006 §阶段 0～1 | 公网 Nginx 不改；平台 :8080 仅本地/SSH；loopback 转发 |
| D2/D5/M3 | DormGuard 认证与 root 迁移 | ADR-007 | `OXELIA_GATEWAY_MODE`；root 与 oxelia51 分离；现网默认 false |

### P1（重要）

| 原编号 | 原问题 | v1.1 预期修复位置 | 验收要点 |
|--------|--------|-------------------|----------|
| M1 | JWT 生命周期缺失 | platform-api §3.4～3.6、§6 | 7d access、30d refresh、logout、黑名单 |
| C4 | 管理 API `:id` vs `:slug` | platform-api §5 | 管理路径用 `:slug` |
| C2 | 忘记密码限流遗漏 | 07 §4、mailer §3 | 三条限流独立计数且摘要含 forgot |
| C3 | `online_capable` 必填矛盾 | tool-registration §3.3 | 缺失默认 false；作品集示例 |
| — | 登录限流仅「建议」 | platform-api §3.4 | 契约级要求，非 optional |
| M4 | 平台与 DormGuard DB 关系 | ADR-007 §1 | PostgreSQL vs MySQL 分离 |

### P2（重要，可后补但 v1.1 应含）

| 原编号 | 原问题 | v1.1 预期修复位置 | 验收要点 |
|--------|--------|-------------------|----------|
| M6 | 邮箱唯一性 | platform-api §3.1、ADR-005 | UNIQUE + 409 |
| M5 | 邮件 Token 仅「建议」 | mailer §2 | 24h Redis 单次，错误码明确 |
| C5 | 阶段 1 DormGuard 状态 | ADR-007 §6 | 三字段取值明确 |
| M2 | slug 不存在 / 上游错误 | gateway §3、platform-api §4.2 | 404/502/503 定义 |
| D3 | CORS 缺 :5173 | ADR-007 §4 | 开发端口列入 |

### P3（建议）

| 原编号 | 原问题 | v1.1 预期修复位置 | 验收要点 |
|--------|--------|-------------------|----------|
| M7 | 徽章字段映射 | platform-api §4.1、tool-registration §6 | open/closed/offline 与字段对应 |
| M8 | 作品集与 tools 关系 | tool-registration §4.2 | `portfolio_items` 独立表 |

---

## 4. 交叉一致性检查（必做）

| 检查项 | 问题 |
|--------|------|
| A | `07-需求确认摘要` 与 `platform-api` 限流条目是否完全一致？ |
| B | `gateway-contract` 中 admin 对 `status=disabled` 是否拒绝？与 `tool-registration §6` 是否一致？ |
| C | `badge` 计算规则是否可由 API 唯一确定？ |
| D | 阶段 1 能否在**不修改公网 Nginx** 前提下完成 ADMIN+AUTH+GW 联调？ |
| E | v1.0 废弃字段 `visitor_visible` 是否在**所有** docs 中清除？ |
| F | refresh token 存储位置（platform-api §6）是否足够明确供实现？ |

---

## 5. 输出格式（请严格遵循）

```markdown
# REV-04 闭环审查报告

**结论**：通过 | 有条件通过 | 不通过
**审查日期**：
**基线**：v1.1

## 逐条验收（16 项）

| 原编号 | 状态 | 证据（文档§） | 备注 |

## 交叉检查（A～F）

| 检查项 | 通过 | 说明 |

## 残余问题（如有）

| 优先级 | 问题 | 建议修复 |

## 实施放行建议

- Cursor 是否可开始 ADMIN-01 / AUTH-01：是/否
- Trae 是否可开始 UI-01～04：是/否
- 是否需 v1.2：是/否
```

---

## 6. 约束

- **只读**：不修改仓库、不生成实现代码。
- 若发现 v1.1 仍阻塞阶段 1，必须标为 **不通过** 并指明文档与章节。
- 若仅存在 P3 级文案瑕疵，可 **有条件通过** 并列出 v1.2 待办。

---

## 7. 提交说明（给审查员）

Cursor 主笔声称已完成 v1.0→v1.1 全部修订，详见 `08-契约审查修订记录.md`。  
请独立复核，勿仅复述该文件；须打开 §2 所列文档逐项验证。

**任务板状态**：REV-04 `in_progress` → 审查完成后更新为 `done` 或 `blocked`。
