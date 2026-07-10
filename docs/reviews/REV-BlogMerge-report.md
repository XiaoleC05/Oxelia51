# 博客合并审查报告（REV-BlogMerge）

**审查日期**：2026-07-06
**基线**：7e4b69e（后端）+ ccb6cc5（前端）

## 安全审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| S1 | P2 | ArticleDetail.jsx:66 + About.jsx:30 | **dangerouslySetInnerHTML 渲染 content** — React 自动转义被绕过，若 `articles.content` / `pages.content` 含恶意 JS（通过 admin 植入或未来外部源导入）则执行 XSS | 添加 DOMPurify 过滤：`dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}`。个人博客当前风险可控（仅 admin 写内容），但 defense-in-depth 推荐 |
| S2 | P1 | handler/article.go:ListPublic | **Category 筛选全参数化 SQL** — 使用 `$1` 占位符，无注入风险 | ✅ 正确 |
| S3 | P1 | handler/article.go:GetPublic | **草稿/禁用文章排除** — `WHERE id = $1 AND enabled = TRUE AND is_draft = FALSE` | ✅ 正确 |
| S4 | P1 | handler/article.go:GetPage | **禁用页面排除** — `WHERE slug = $1 AND enabled = TRUE` | ✅ 正确 |
| S5 | P1 | cmd/server/main.go | **Admin 路由中间件** — 所有 `/api/admin/articles` / `/api/admin/pages` 路由在 admin group 下，挂载 authMW + RequireAdmin | ✅ 正确 |
| S6 | P1 | handler/article.go:Create + Update + Delete | **全部 SQL 使用参数化查询** — 无字符串拼接 | ✅ 正确 |

## 逻辑审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| L1 | P2 | handler/article.go:Update | **Update 缺少 URL 格式验证** — Create 有 `if req.URL[:4] != "http"` 校验，但 Update 无此校验，可写入无效 URL | 在 Update 中添加相同 URL 格式验证 |
| L2 | P2 | handler/article.go:GetPublic | **id 参数无整数校验** — `c.Param("id")` 获取字符串直接传入 SQL，pgx 接受字符串但 WHERE id = 'abc' 会全表扫描或类型转换错误 | 使用 `strconv.Atoi` 提前校验，或依赖 pgx 隐式类型转换（实际不会出错，但建议加校验） |
| L3 | P2 | ArticleDetail.jsx:58 | **content 为空但有 url 的文章显示正确** — 走 "本文暂无正文内容" + "阅读原文" 分支 | ✅ 正确 |
| L4 | P2 | Landning.jsx 文章区块 | **Landing 页使用 fetchArticles() → apiGet('/articles') → 后端 ListPublic 自动过滤 is_draft=FALSE** | ✅ 草稿被排除 |
| L5 | P3 | handler/article.go:Categories | **分类统计仅统计 enabled + 非草稿 + 非空分类** — `WHERE enabled=TRUE AND is_draft=FALSE AND category!=''` | ✅ 正确 |
| L6 | P2 | handler/article.go:UpdatePage | **页面 slug 不可通过 API 修改** — 使用 URL param `:slug` 作为标识，请求体不含 slug 字段 | ✅ 正确 |
| L7 | P2 | handler/article.go:Update | **tags COALESCE 与空数组行为** — `Tags []string` 不是 `*[]string`，前端发送 `"tags": []` 时为非 nil 空切片，COALESCE($7, tags) = []（空数组）而非保留旧值。即无法通过 Update API 单纯不清除 tags 而保留旧值 | 将 `Tags` 改为 `*[]string`，后续修复 |

## 一致性审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| C1 | P2 | 008_articles_extend.up.sql vs model vs handler | **新增字段 content/tags/is_draft 在迁移、model、handler 中完全一致** | ✅ 四层对齐 |
| C2 | P2 | pages 表 vs Page model vs handler | **pages 表字段 id/slug/title/content/enabled/dates 在 3 层中一致** | ✅ 对齐 |
| C3 | P2 | ArticleListItem vs ListPublic SQL | **列表项字段 id/title/summary/category/tags/published_at/display_order 匹配** | ✅ 对齐 |
| C4 | P2 | Blog.jsx 分类筛选 | **前端 `fetchArticles(selectedCat)` → `apiGet('/articles?category='+cat)` → handler 读取 `c.Query('category')`** | ✅ 参数名匹配 |
| C5 | P2 | api/index.js fetchArticles/fetchArticle/fetchCategories/fetchPage | **4 个新 API 函数名称与后端路径一致** | ✅ 已确认 |

## UX 审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| U1 | P3 | Blog.jsx | **空文章状态** — `blog-empty` 显示"暂无文章" | ✅ 已处理 |
| U2 | P3 | ArticleDetail.jsx | **文章不存在状态** — `fetchArticle` 返回 404 → `setError(err.message)` → 显示错误信息。后端返回 `ARTICLE_NOT_FOUND`，前端为用户显示后端原始 error 文案 | 建议前端区分 `err.message.includes('ARTICLE_NOT_FOUND')` → 显示「文章不存在或已删除」，其余错误显示「加载失败」 |
| U3 | P3 | About.jsx | **页面不存在状态** — `fetchPage` 返回 404 → `setError(err.message)` → 显示错误信息。同上问题 | 同 U2 建议 |
| U4 | P3 | Blog.jsx + Blog.css | **移动端分类侧栏** — 当前 `.blog-layout` 使用 flex 布局，移动端 `.blog-sidebar` 可能宽度过窄 | 确认 CSS 有 `@media (max-width: 768px)` 将 `.blog-sidebar` 转为横向按钮条 |
| U5 | P2 | ArticleDetail.jsx | **content 展示时无骨架/placeholder** — `dangerouslySetInnerHTML` 内容加载时直接渲染，大段 HTML 可能阻塞主线程 | 建议 `article.content` 首次渲染后无问题；长期可考虑拆分长内容 |
| U6 | P3 | Navbar.jsx | **博客改为内部链接 + 关于链接**：`/blog` `/about` | ✅ Navbar 中正确替换 |
| U7 | P3 | Landing.jsx | **文章区块链接改为内部路径**：`/blog/${article.id}` | ✅ 正确 |

## 总体评价

**评分：7.5/10**

博客合并功能整体质量较高。安全方面：SQL 全部参数化、admin 路由中间件正确、草稿/禁用文章正确排除。逻辑方面：content/url 双路径显示处理精细、分类筛选参数化。一致性方面：迁移→模型→handler→前端四层字段完全对齐。UX 方面：loading/error/empty 三态全覆盖。

### 主要关注点

1. **S1 (P2)** — `dangerouslySetInnerHTML` 绕过 React XSS 防护。当前风险可控（仅 admin 写内容），但添加 DOMPurify 是防御纵深最佳实践
2. **L1 (P2)** — Update 缺少 URL 格式验证，Create 有但 Update 遗漏
3. **L7 (P2)** — `Tags []string` 非指针类型，前端无法"不更新 tags"（发送 `"tags": null` 时为 nil→COALESCE 保留旧值；发送 `"tags": []` 时为非 nil 空切片→覆盖为空）。应改为 `*[]string`
4. **U2/U3 (P3)** — 前端可直接根据后端 `code` 字段提供用户友好的错误提示，而非透传原始 error 信息

### 可合并性

**可合并**。无 P0/P1 阻断。建议修复 L1（Update URL 校验）和 L7（Tags 指针类型）后再合并，或标记为已知问题在下一迭代修正。

**需 v1.2 契约修订**：否
