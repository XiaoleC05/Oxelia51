---
from: Codex (Architecture Agent)
to: Hermes (Frontend Agent)
task: TOOL-05-2
status: ready
date: 2026-07-09
depends_on: TOOL-05-1 (已完成，commit 04dcf23)
blocks: none
---

> **Hermes 职责边界（AGENTS.md §4.3）**
> - ✅ 可修改：前端源代码、组件、样式、静态资源、前端文档
> - ❌ 不得修改：后端、数据库、API 定义、构建工作流、服务器配置
> - ⚠️ 上报：缺少 API、API 不一致、需求不明确、导航重设计、全局 UI 重设计
> - **完成标准**：页面正确渲染、无布局问题、响应式设计有效、构建成功
> - 参照 DormGuard 工具壳模式，不引入新依赖

# TOOL-05-2：SuperRead 前端工具壳

## 背景

SuperRead 后端已完成（TOOL-05-1，commit 04dcf23）。
现在需要替换 `frontend/src/tools/superread/SuperReadTool.jsx` 的占位壳为真实 UI。

后端端口：8002，Gateway 代理：`/api/tools/superread/proxy/*path`

## 需替换的文件

```
frontend/src/tools/superread/
├── SuperReadTool.jsx  ← 替换占位壳
└── SuperReadTool.css  ← 新建
```

## 功能需求

### 1. 源管理页（默认视图）

- 源列表：名称 + URL + 最近抓取时间 + 错误状态
- 「添加源」按钮 → 输入框弹窗（URL）
- 「导入 OPML」→ 文件上传
- 每个源：删除按钮、手动抓取按钮

### 2. 文章列表

- 按时间倒序，每篇显示：标题、来源名、发布时间、摘要（AI 生成）、标签
- 筛选栏：全部 / 星标 / 按源 / 按标签
- 已读文章半透明
- 点击文章 → 展开/新窗查看（inline 展开显示全文 + 摘要）

### 3. 每日简报

- 独立 Tab：展示当天所有源的新文章汇总
- 每篇文章含 AI 摘要
- 去重提示（同一事件多源报道）

### 4. 设置

- API Key 输入（密码框）
- API Base URL 输入
- 模型选择（下拉）
- 抓取间隔（数字输入，分钟）

## API 调用

所有 API 通过 `api/index.js` 的 gateway proxy 调用，路径前缀：

```
# 正确用法：apiProxy('superread', 'api/feeds')，不要拼接完整路径
```

| 前端操作 | API 调用 |
|----------|----------|
| 获取源列表 | `get('/feeds')` |
| 添加源 | `post('/feeds', { feed_url })` |
| 删除源 | `del('/feeds/:id')` |
| 手动抓取 | `post('/feeds/:id/fetch')` |
| OPML 导入 | `post('/feeds/import', formData)` |
| 文章列表 | `get('/articles?feed_id=&starred=&tag=')` |
| 更新文章 | `patch('/articles/:id', { is_read, is_starred, tag })` |
| 每日简报 | `get('/daily-brief')` |
| 获取设置 | `get('/settings')` |
| 更新设置 | `put('/settings', { api_key, api_base, model })` |

## 技术约束

1. 参照 `frontend/src/tools/dormguard/DormGuardTool.{jsx,css}` 的工具壳模式
2. 使用平台现有 Lucide 图标（Rss、Star、Settings、Trash2、RefreshCw、Upload、FileText 等）
3. 不引入新依赖
4. 移动端响应式
5. 遵循平台设计变量（`--bg`、`--border`、`--accent` 等）

## 接受标准

- [ ] `npm run build` 零 error / warning
- [ ] `/tools/superread` 页面正确渲染
- [ ] 源管理 CRUD 流程完整
- [ ] 文章列表筛选（全部/星标/按源/标签）
- [ ] 每日简报 Tab
- [ ] 设置页 API Key 输入
- [ ] OPML 导入
- [ ] 移动端响应式正常
- [ ] 与平台视觉风格一致
*** End of File
