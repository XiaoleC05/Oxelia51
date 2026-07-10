# 13 项增强审查报告（REV-Enhancements）

**审查日期**：2026-07-06
**基线**：51cda9a（后端）+ bce99a3（前端）

## 安全审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| S1 | P1 | handler/article.go:Search | **Search 使用参数化 SQL（$1）** — ILIKE 拼接的模式串 `%q%` 通过参数化传入，无注入风险 | ✅ 正确 |
| S2 | P2 | Navbar.jsx:search-results render | **搜索结果渲染使用 JSX 插值** — `{t.name}`、`{t.description}`、`{a.title}` 等均通过 React 自动转义，无 XSS | ✅ 正确 |
| S3 | P2 | ArticleDetail.jsx:67 | **dangerouslySetInnerHTML 仅用于 article.content** — 无新增误用 | ✅ 与上轮一致 |
| S4 | P1 | api/index.js searchAll | **searchAll 使用 encodeURIComponent** — 搜索关键词被正确编码 | ✅ 正确 |
| S5 | P1 | handler/article.go:Update | **URL 格式验证已添加** — Create 和 Update 现在都有 `(*req.URL)[:4] != "http"` 校验 | ✅ L1 已修复 |
| S6 | P2 | handler/article.go:GetPublic | **ID 整数校验已添加** — `fmt.Sscanf(id, "%d", &idInt)` 防止非数字输入导致 SQL 类型错误 | ✅ L2 已修复 |

## 性能审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| P1 | P3 | ScrollProgress.jsx:7-25 | **scroll 事件无 requestAnimationFrame 节流** — 每次滚动都调用 `setPct` 触发 React re-render。`passive: true` 防止阻塞主线程，但瘦客户端仍可能卡顿 | 将 `handleScroll` 内联调用换成 `requestAnimationFrame` 包装：`if (raf) return; raf = requestAnimationFrame(() => { ...; raf = null })` |
| P2 | P3 | BackToTop.jsx:7-15 | **同样无节流** — `setVisible` 每次滚动事件都触发 | 同上建议 |
| P3 | P2 | Navbar.jsx:search | **搜索 300ms 防抖** — 使用 `useEffect` + `clearTimeout` 实现 | ✅ 正确 |
| P4 | P3 | Navbar.jsx:scroll handler | **Navbar scroll 处理无节流** — 同上模式，`passive: true` 但无 RAF | 建议同 P1 添加 RAF 包装 |
| P5 | P2 | Blog.jsx:tagCloud | **标签云 useMemo 缓存** — `tagCloud` 使用 `useMemo` 依赖 `articles`，仅在数据变化时重新计算 | ✅ 正确 |
| P6 | P2 | ArticleDetail.jsx:related articles | **相关文章 fetch 在 useEffect 中** — 文章加载后异步请求，不阻塞主渲染 | ✅ 正确 |

## 逻辑审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| L1 | P2 | index.css + Navbar.jsx | **暗色模式** — localStorage 保存 + 系统偏好检测 + data-theme 属性。CSS 变量完整覆盖 bg/text/accent/border/code。3 秒 transition 动画 | ✅ 完整 |
| L2 | P2 | Navbar.jsx:search | **搜索面板** — 300ms debounce、ESC 关闭、外部点击关闭 | ✅ 完整 |
| L3 | P2 | Navbar.jsx:search | **搜索空状态** — `searchQuery.length >=2 && no results` → "无结果" | ✅ 覆盖 |
| L4 | P2 | BackToTop.jsx | **显示阈值** — `window.scrollY > window.innerHeight`（超过一个视口高度）| ✅ 合理 |
| L5 | P2 | ArticleDetail.jsx:related | **相关文章排除自身** — `list.filter((a) => a.id !== data.id).slice(0, 3)` | ✅ 正确 |
| L6 | P2 | Blog.jsx:tag | **标签云点击筛选 + 取消筛选** — `handleTagClick` 切换 `selectedTag`，再次点击同一标签取消。分类切换时重置 tag 筛选 | ✅ 正确 |
| L7 | P2 | Landing.jsx | **骨架屏** — ArticleDetail 有 skeleton CSS 类；Landing 未使用 skeleton，仅普通文字 loading | Landing 可接受文字 loading |
| L8 | P3 | ArticleDetail.jsx:reading-time | **阅读时间** — `content.replace(/<[^>]+>/g, '').length / 400`，去标签后计算中文字数 / 400 字每分钟 | ✅ 正确 |
| L9 | P2 | ScrollProgress.jsx | **双模式支持** — 接收 `selector` prop：传入时为文章阅读进度（基于元素可见区域），不传时为页面滚动进度 | ✅ 灵活设计 |

## UX 审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| U1 | P3 | index.css [data-theme="dark"] | **暗色模式头图文字** — 头图文字使用 `var(--text-h)` 和 `var(--text)`，暗色模式下分别为 `#f0f0f0` 和 `#c4c4c4`，在深色背景上可读 | ✅ 可读性 OK |
| U2 | P2 | Navbar.jsx:search | **搜索无结果提示** — "无结果"仅文字，无图标/CTA 建议 | 可选：添加"试试其他关键词"建议 |
| U3 | P3 | Landing.jsx | **骨架屏** — ArticleDetail 已实现 skeleton（5 个块），Landing 无骨架屏 | Landing 当前非内容型页面，可接受 |
| U4 | P2 | index.css transitions | **主题切换过渡** — `transition: background-color 0.3s, color 0.3s, border-color 0.3s` 使暗色/亮色切换平滑 | ✅ 已处理 |
| U5 | P2 | Blog.jsx tag cloud | **标签云视觉权重** — `font-size: 0.75+(count/max)*0.45rem`，在 0.75rem~1.2rem 之间按频率缩放 | ✅ 合理 |
| U6 | P2 | Navbar.css /index.css | **搜索面板覆盖所有页面** — Navbar 在所有页面挂载，搜索面板全局可用。暗色模式下搜索面板样式正确 | ✅ |

## 总体评价

**评分：8.0/10**

本次 13 项增强整体实现质量高。安全上无新增风险，搜索 API 使用参数化 SQL + encodeURIComponent + 防抖。性能方面 scroll 事件缺 RAF 节流是唯一值得关注的优化点（但 `passive: true` 已到位），其余 debounce/memo/异步加载均正确。

### 亮点

- **暗色模式**：localStorage 持久化 + 系统偏好检测 + CSS 变量全覆盖 + 3 属性过渡动画。是项目中第一次系统化引入主题系统
- **搜索面板**：300ms 防抖、encodeURIComponent 编码、ESC/外部点击关闭、loading/results/empty 三态零遗漏
- **阅读进度条**：支持阅读模式（基于元素）和页面模式，设计优雅
- **标签云**：font-size 按频率缩放、客户端筛选/取消、分类+标签双筛交互互斥

### 改进建议

1. **P1 (P3)** — 为 ScrollProgress 和 BackToTop 添加 requestAnimationFrame 节流，避免快速滚动时过多 setState
2. **U2 (P3)** — 搜索无结果时添加友好提示
3. **L7 (P3)** — Landing 骨架屏可后续迭代

### 可合并性

**可合并**。无 P0/P1 安全或功能阻塞。
**需 v1.2 契约修订**：否
**后端修订（L1/L2）已确认修复**：✅ Update URL 校验 + GetPublic ID 整数校验
