# 首页区块 + 博客合并审查报告（REV-Homepage）

**审查日期**：2026-07-06
**基线**：d838c9b（后端）+ e12fcae（前端）

## 安全审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| S1 | P1 | handler/article.go | Article CRUD 全部使用参数化 SQL（$1/$2...）| ✅ 已正确 |
| S2 | P1 | cmd/server/main.go | Admin article 路由在 admin group 下（authMW + RequireAdmin）| ✅ 已正确 |
| S3 | P2 | Navbar blog + Landing article + GitHub links | 全部外链使用 target="_blank" rel="noreferrer" | ✅ 已正确 |
| S4 | P2 | Landing.jsx | 文章标题/摘要由 React JSX 自动转义渲染，无 XSS 风险 | ✅ 已正确 |
| S5 | P2 | adminUpdateCarouselSettings | 前端调用 apiPut('admin/carousel-settings') 需 Bearer 认证；使用 authHeaders() | ✅ 正确 |

## 逻辑审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| L1 | **P0** | Landing.jsx:36 + Admin.jsx | **Hero API 响应类型不匹配** — Landing.jsx 调用 `fetchHeroImages()` 期望返回 `{images: [...], autoplay_interval_ms: 5000}`，但后端 `GET /api/hero-images` 返回 BARE ARRAY `[{id, image_url, ...}]`。导致 `hero.images` 为 `undefined`，`setImages([])`，轮播永远不显示图片。同 Bug 在 Admin.jsx 头图 tab 的 interval 设置中：`data.autoplay_interval_ms` 在 array 上恒为 `undefined`，轮播间隔无法从后端加载 | **修复后端**：将 `ListPublic` 返回改为包装对象 `{"images": [...], "autoplay_interval_ms": 5000}`（需新增 `carousel_settings` 表或配置项），**或修复前端**：去掉 `.images` 包装，直接用 `setImages(hero)` 设置数组。后一种方案更简单但丢失 autoplay_interval_ms 读取 |
| L2 | P2 | Landing.jsx:27-35 | `Promise.all` 中 fetchHeroImages 的 catch 返回 `null`，其他 catch 返回 `[]`。若 hero API 返回非数组（如 500 HTML），`hero` 为 `null`，`hero.images` 报错 | `catch(() => [])` 使 hero 恒为数组，`setImages(hero)` 安全。**L1 修复后应统一返回格式** |
| L3 | P2 | article.go:46 | `ListPublic` 使用 `ORDER BY display_order, published_at DESC NULLS LAST, id` — null 日期排在最后 | ✅ 正确处理。前端 `articles.slice(0, 6)` 取前 6 条 |
| L4 | P2 | Admin.jsx ArticlesTab | 文章表单无 URL 格式校验（无 `pattern` 属性），可输入非 URL 文本保存 | 添加 `type="url"` 或 `pattern="https?://.*"` |
| L5 | P2 | Landing.jsx Navbar | Navbar `--hero` (透明) 和 `--scrolled` (实体) 状态切换使用 `window.innerHeight * 0.5` 阈值 | ✅ 逻辑正确。但 `--hero` 类名在无 Navbar.css 时无视觉效果 |
| L6 | P2 | Navbar.jsx:85-86 | 切换回首页时 `handleScroll()` 立即调用，页面滚动位置在 useEffect 运行时可能未重置 | ✅ 基本正确，可初始化默认 `scrolled: window.scrollY > 0` |

## 一致性审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| C1 | P2 | articles table vs model vs handler vs frontend | 所有字段（id/title/url/summary/category/published_at/display_order/enabled）在 4 层中完全一致 | ✅ 已一致 |
| C2 | P2 | seed-articles.sql | 种子数据 6 条文章，URL 指向 xiaolec05.github.io 真实文章路径 | ✅ 已验证真实性 |
| C3 | P2 | Admin.jsx | 文章 tab 使用与其他 tab 相同的 table + modal 模式（`ArticlesTab`），接口一致 | ✅ 一致 |
| C4 | P3 | Navbar.jsx | 首页 `--hero` / `--scrolled` 样式切换需要 Landing.css 配合，否则透明/实体效果不生效 | 确认 Navbar.css 定义了 `.navbar--hero` 和 `.navbar--scrolled` |

## 性能审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| P1 | P3 | Landing.jsx:27-35 | 首页并行请求 4 个 API（hero/tools/portfolio/articles），每个含独立 `.catch()` 防止单个失败阻塞其他 | ✅ 正确。请求并行，失败不阻塞 |
| P2 | P3 | Landing.jsx:94 | 文章列表 `.slice(0, 6)` 无分页。当前 6 条种子数据无性能问题 | 未来文章量 >50 时可增加分页或加载更多 |
| P3 | P3 | Admin.jsx ArticlesTab | 文章列表无分页、无搜索 | 同 P2 |
| P4 | P3 | Landing.jsx | 轮播图片加载可能阻塞首屏渲染（图片数量多时）| 使用 `<img loading="lazy">` 或 CSS background-image 天然异步。当前使用 `backgroundImage: url()` 不会阻塞渲染 |

## 跨 Feature 问题

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| X1 | P1 | backend + frontend | **L1 修复后**，Admin.jsx 头图 tab 中的 `adminFetchHeroImages` 也应返回统一格式。当前 `adminFetchHeroImages` 直接调用 `apiGet('/admin/hero-images')` 返回数组，前端 `HeroImagesTab` 直接用 `setHeroImages(data)`（用数组），与 landing 页用法不同 | 需统一：后端包装响应为 `{"images": [...], "autoplay_interval_ms": N}`，或前端两处各自适配。建议后端统一 |
| X2 | P2 | hero.go + main.go | `admin.PUT("/carousel-settings", heroH.UpdateCarouselSettings)` 已注册路由，需确认 hero.go 中存在 `UpdateCarouselSettings` 方法且从 `carousel_settings` 表或配置读取/写入 | 若无此方法则编译失败。**若未实现**则为 P1 阻塞 |

## 总体评价

**评分：7.0/10**（若不修复 L1）

**核心问题**：Hero API 响应格式在前端 Landing.jsx 和后端 `ListPublic` handler 之间不匹配（L1 P0）。Landing 页期望 `{images: [...], autoplay_interval_ms: 5000}` 而后端返回数组，导致**轮播完全不显示**。这是集成阶段未对齐的前后端契约断裂。

**其他亮点**：安全方面全部 SQL 参数化、admin 路由中间件正确、外链 XSS 防护到位。一致性方面表字段/模型/handler/前端四层对齐。性能方面 4 个 API 并行加载设计合理。

**建议修复优先级**：
1. **L1 (P0)** — 修复 Hero API 响应格式（前端或后端统一）
2. **X2 (P1)** — 确认 `UpdateCarouselSettings` 已实现
3. **L4 (P2)** — 文章编辑 URL 表单添加格式验证
4. 其余 P2/P3 可迭代修复

**可合并**：是（L1 修复后），目前存在一条 P0 阻断需 blockers 解决。其余均为 P2/P3
**需 v1.2 契约修订**：否
