---
from: Codex (Architecture Agent)
to: Qoder Wake (Frontend Agent)
task: TOOL-03
status: blocked_by_TOOL-02
date: 2026-07-08
depends_on: TOOL-02
blocks: none
---

# TOOL-03：SecretStore 前端工具壳

## 背景

SecretStore 是 Oxelia51 的新在线工具——加密保险箱。
后端（TOOL-02，Cursor）提供 REST API，你的任务是构建前端界面。

## 路由

`/tools/secretstore` — 通过 Oxelia51 工具壳机制加载 `SecretStoreTool.jsx`。
Gateway 代理：`/api/tools/secretstore/proxy/*path` → `http://127.0.0.1:8001`

## 功能需求

SecretStore 前端需实现以下页面/区域：

### 1. 保险箱主页
- 列出用户的所有 Entry（标题 + 模板类型标签）
- 搜索/筛选
- 「新建 Entry」按钮

### 2. 新建/编辑 Entry
- 选择模板（8 种标准模板）或自定义
- 根据模板动态渲染字段输入框
- 密码字段显示/隐藏切换
- 保存/取消

### 3. Entry 详情
- 展示所有字段（敏感字段默认掩码，点击显示）
- 复制单个字段值
- 编辑/删除

### 4. Combo 管理
- 列出所有 Combo
- 新建 Combo（从已有 Entry 中选择）
- 删除 Combo

### 5. 导出
- 加密导出按钮

## 技术约束

1. **文件位置**：`frontend/src/tools/secretstore/SecretStoreTool.jsx` + `.css`
2. **路由注册**：在 `frontend/src/App.jsx` 中参照现有工具壳模式
3. **API 调用**：所有请求通过 `api/index.js` 的 gateway proxy
4. **样式**：遵循平台现有设计语言（变量 `--bg`、`--border`、`--accent` 等）
5. **不引入新依赖**：使用平台已有的 React Router、Lucide 图标
6. **响应式**：移动端适配

## 参考实现

参照 `frontend/src/tools/dormguard/DormGuardTool.{jsx,css}` 的工具壳模式：
- 使用 `api.js` 的 `get`/`post`/`patch`/`del` 方法
- 调用路径为 `tools/secretstore/proxy/api/xxx`

## API 契约（TOOL-02 提供）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/entries | 列出 Entry |
| POST | /api/entries | 创建 Entry |
| GET | /api/entries/:id | 获取详情 |
| PATCH | /api/entries/:id | 更新 |
| DELETE | /api/entries/:id | 删除 |
| GET | /api/templates | 模板列表 |
| GET | /api/combos | Combo 列表 |
| POST | /api/combos | 创建 Combo |
| DELETE | /api/combos/:id | 删除 Combo |
| POST | /api/vault/export | 加密导出 |

## 接受标准

- [ ] `npm run build` 零 error / warning
- [ ] `/tools/secretstore` 页面正确渲染
- [ ] Entry CRUD 流程完整
- [ ] 敏感字段掩码/显示切换正确
- [ ] 8 种模板动态表单渲染
- [ ] 移动端响应式正常
- [ ] 与平台视觉风格一致
*** End of File
