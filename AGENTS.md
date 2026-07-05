# Oxelia51 多 Agent 协作规则

## Agent 职责边界

| 角色 | 负责 | 不负责 |
|------|------|--------|
| **Cursor** | 后端 API、数据库、网关、鉴权、部署脚本、CI/CD、安全修复、Bug 修复、审查后修复执行 | 任何 CSS/JSX 视觉设计、布局、配色、字体、间距、动画 |
| **Trae** | 全部前端视觉：CSS、JSX 结构微调、配色、字体、布局、间距、动画、响应式、UI 交互 | 后端代码、API 逻辑、数据库、路由表、package.json |
| **Codex** | 只读审查：安全、逻辑、一致性、Bug、测试覆盖 | 不改任何代码，只输出报告 |

## 硬约束

1. Cursor 不写 CSS——任何 `.css` 文件的视觉属性由 Trae 负责
2. Cursor 可改 JSX 业务逻辑（API 调用、state、条件渲染、事件处理），但不改 JSX 视觉结构
3. Cursor 可新建 JSX/CSS 文件骨架，视觉打磨交给 Trae
4. 用户要求 UI 变更时，Cursor 产出 Trae 提示词，不直接改样式
5. Codex 审查后涉及前端视觉的修复，Cursor 写提示词给 Trae

## Cursor 例外（可改前端）

- 新增功能页面初始骨架（仅功能逻辑 + 最小样式）
- API 调用逻辑修复（fetch/header/token/error handling）
- 路由注册（App.jsx 的 `<Route>` 添加）
- 表单提交逻辑、loading/disabled 状态（功能行为）

## 判定流程

```
用户要求变更
    → 后端/数据库/部署/安全/CI → Cursor 做
    → 前端视觉/CSS/布局/配色 → 产出 Trae 提示词
    → 前端业务逻辑/API/路由/表单 → Cursor 做
    → 代码审查 → 产出 Codex 提示词
```
