# Oxelia51 前端 UI 样式统一标准

**版本**：v1.0 | **日期**：2026-07-15
**适用范围**：所有前端页面、组件、工具壳

---

## 1. 设计 Token（CSS 变量）

### 1.1 颜色

全部 CSS 变量定义在 [frontend/src/index.css](/D:/07_Projects/code/Oxelia51/frontend/src/index.css:8) `:root` 与 `[data-theme="dark"]` 块中。

| 变量 | 亮色模式 | 暗色模式 | 用途 |
|------|---------|---------|------|
| `--bg` | `#fafaf7` | `#1a1d24` | 页面主背景 |
| `--bg-alt` | `#f0efe9` | `#22262e` | 卡片、面板、隔行背景 |
| `--bg-dark` | `#f0efe9` (亮) / `#1a1d24` (暗) | 首页统计栏、页脚深色区 |
| `--text` | `#2a2a2a` | `#c4c4c4` | 正文 |
| `--text-h` | `#0d0d0d` | `#f0f0f0` | 标题、强强调文本 |
| `--text-muted` | `#6b6b6b` | `#888` | 辅助文字、描述、placeholder |
| `--accent` | `#c8553d` | `#d96b5a` | 主强调色：链接 hover、焦点环、高亮线条 |
| `--accent-2` | `#2c6e49` | `#3d8b5f` | 次强调色：成功状态、次要装饰 |
| `--accent-bg` | `rgba(200,85,61,0.07)` | `rgba(217,107,90,0.12)` | 标签背景（含强调色染） |
| `--accent-border` | `rgba(200,85,61,0.35)` | `rgba(217,107,90,0.4)` | 半透明强调色边框 |
| `--border` | `#e0ddd5` | `#2e323a` | 分割线、卡片边框、输入框底线 |
| `--code-bg` | `#f4f3ec` | `#282c34` | `<code>` 内联代码背景 |
| `--social-bg` | `rgba(240,239,233,0.5)` | `rgba(34,38,46,0.5)` | 社交链接背景 |

**亮色模式覆写**：`[data-theme="light"]` 下 `--bg-dark` 覆写为 `#f0efe9`，确保统计栏/页脚在亮色模式下背景不突兀。

### 1.2 字体

| 变量 | 栈 | 用途 |
|------|----|------|
| `--sans` | `'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif` | 正文、UI 文本、全局默认 |
| `--heading` | `'Noto Serif SC', 'Source Han Serif SC', Georgia, serif` | 内嵌板块标题（DevTimeline、BugCards） |
| `--mono` | `'JetBrains Mono', ui-monospace, Consolas, monospace` | 数字、代码、日期、等宽场景 |

**根字体**：`:root { font: 16px/1.7 var(--sans); }`  
**移动端**：`<=640px` → `15px`，`<=380px` → `14px`

### 1.3 间距

| 场景 | 值 |
|------|----|
| 页面水平 padding | `clamp(24px, 5vw, 80px)` |
| 移动端水平 padding | `16px`（含 `safe-area-inset`） |
| 卡片内边距 | `18-20px` |
| 按钮内边距 | `10px 24px`（默认） |
| 图标按钮尺寸 | `32x32`（桌面）`44x44`（移动端） |

### 1.4 圆角

| 元素 | 值 |
|------|----|
| 按钮、输入框、下拉菜单 | `6px` |
| 卡片、统计卡片内格 | `8px` |
| Bug 卡片 | `12px` |
| 头像/圆形图标 | `50%` |
| 标签（badge/pill） | `10px`（胶囊）或 `2px`（直角标签） |

### 1.5 阴影

| 层级 | 值 |
|------|----|
| 卡片 hover | `0 8px 24px rgba(0,0,0,0.08)` |
| 统计卡 hover | `0 8px 24px rgba(0,0,0,0.25)`（暗色模式加强） |
| Bug 卡展开 | `0 12px 32px rgba(134,59,255,0.12)` |
| 导航下拉菜单 | `0 8px 32px rgba(0,0,0,0.1)` |
| 回顶按钮 | `0 2px 8px rgba(0,0,0,0.08)` |

---

## 2. 排版规范

### 2.1 标题层级

| 层级 | 字号 | 字重 | 字体 | 使用场景 |
|------|------|------|------|----------|
| h1（Hero） | `clamp(2.5rem, 5vw, 4rem)` | 600 | `var(--sans)` | Hero 大标题、页面主标题 |
| h1（内容） | `clamp(2rem, 4.5vw, 3.2rem)` | 600 | `var(--sans)` | Hero 副标题级 |
| h2 | `clamp(1.5rem, 3vw, 2rem)` | 600/700 | `var(--sans)` | 页面区块标题 |
| h2（板块） | `clamp(1.4rem, 3vw, 1.8rem)` | 600/700 | `var(--heading)` | DevTimeline、BugCards 标题 |
| h3 | `1.2rem` | 600 | `var(--sans)` | 卡片内标题 |
| 区块内标题 | `24px` / `1.4rem` | 600/700 | `var(--heading)` | 嵌入内容板块的小标题 |

**设计依据**：页面级标题使用 `--sans`（Inter）保持简洁现代感；嵌入内容板块标题使用 `--heading`（Noto Serif SC）衬线体，在视觉上标识内容边界并提供节奏变化。AGENTS.md §7.1 记录了完整约定。

### 2.2 正文

| 元素 | 字号 | 行高 | 颜色 |
|------|------|------|------|
| 正文 p/li | `16px` / `1rem` | `1.7` | `var(--text)` |
| 辅助描述 | `14px` / `13px` | `1.6` | `var(--text-muted)` |
| 小标签 | `12px` / `11px` | — | `var(--text-muted)` |
| 移动端正文字对齐 | — | — | `text-align: justify` |

### 2.3 其他文本

| 元素 | 字号 | 字体 |
|------|------|------|
| 数字/计数 | `clamp(1.8rem, 4vw, 2.4rem)` | `var(--mono)`, `font-variant-numeric: tabular-nums` |
| 代码内联 | `14px` | `var(--mono)` |
| 日期标签 | `13px` / `12px` | `var(--mono)` |
| 导航链接 | `14px` | `var(--sans)`, `font-weight: 500` |

---

## 3. 颜色使用规则

### 3.1 `--accent`（主强调色 `#c8553d` / `#d96b5a`）

- 链接 hover 态
- 按钮 primary 背景
- 焦点环（`:focus-visible` box-shadow）
- 当前激活的导航项/指示点
- 分区标题左侧强调线（`border-left: 3px solid var(--accent)`）
- 回顶按钮边框
- 标签文字色（Bug agent 标签等）

### 3.2 `--accent-2`（次强调色 `#2c6e49` / `#3d8b5f`）

- 成功状态、已上线徽章
- 工具卡片左侧强调线（作品集区域）
- 开源作品标签底色

### 3.3 背景层级

```
--bg      → 页面主背景
--bg-alt  → 卡片、面板、非 Hero 的 section 背景
--bg-dark → 页脚、统计栏、Hero 暗色基底
```

### 3.4 文本层级

```
--text-h     → 标题、重要信息（最高对比度）
--text       → 正文（中等对比度）
--text-muted → 辅助信息、placeholder、时间戳（最低对比度）
```

---

## 4. 组件模式

### 4.1 按钮

```css
/* 默认按钮（全局） */
button {
  font-family: var(--sans);
  font-size: 16px;
  font-weight: 500;
  padding: 10px 24px;
  border: 1px solid var(--text-h);
  border-radius: 6px;
  background: var(--text-h);
  color: var(--bg);
  transition: opacity 0.2s, background 0.2s;
}
button:hover { opacity: 0.88; }
button:active { opacity: 0.72; }
```

**变体**：

| 类型 | 实现方式 | 示例 |
|------|---------|------|
| Primary | `background: var(--accent); color: #fff; border-color: var(--accent);` | CTA 按钮 |
| Ghost | `background: transparent; border-color: var(--border); color: var(--text-h);` | 次要操作 |
| 图标按钮 | `.navbar-icon-btn`：`32x32`，圆角 `6px`，`border: 1px solid var(--border)` | 搜索、主题切换 |
| 导航项按钮 | `.navbar-item--btn`：透明背景、无边框、无 padding，仅文字+图标 | 退出登录 |

**移动端**：所有按钮 `min-height: 44px; min-width: 44px;`

### 4.2 卡片

```css
.card-base {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-alt);
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1),
              box-shadow 0.25s cubic-bezier(0.4,0,0.2,1),
              border-color 0.25s cubic-bezier(0.4,0,0.2,1);
}
.card-base:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  border-color: var(--accent);
}
```

**变体**：

- **工具卡/作品卡**：左 3px 强调色条（`--accent` / `--accent-2`），padding `20px`
- **Bug 卡**：圆角 `12px`，`role="button"` + `tabIndex={0}` + 键盘事件，展开态边框变色
- **统计卡**：暗色背景 (`--bg-dark`)，半透明面板，hover 上移 3px

### 4.3 输入框

```css
input, textarea {
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
  color: var(--text-h);
  font-size: 16px; /* 防止 iOS 缩放 */
  padding: 10px 0;
  transition: border-color 0.2s;
}
input:focus, textarea:focus {
  outline: none;
  border-bottom-color: var(--accent);
}
```

### 4.4 导航栏

- 固定顶部 `position: fixed; z-index: 100`
- Hero 态：透明背景 `background: transparent`，白色文字 + text-shadow
- 滚动态：实色背景 `background: var(--bg)`，标准文字色
- 移动端：汉堡菜单动画（三横线 -> X），全屏下拉面板
- 搜索面板：绝对定位下拉，300ms 防抖
- 用户菜单：dropdown，点击外部关闭

### 4.5 页脚

- 首页：Landing 组件内置 `.landing-footer`（含导航链接 + 品牌信息）
- 其他页面：`GlobalFooter` 组件（复用 `.landing-footer` 类名）
- 背景 `var(--bg-dark)`，暗色模式标准，亮色模式覆写为浅色

### 4.6 浮球（FAB）

- SmartKB：`z-index: 9998`，Portal 挂 `<body>`，页面切换不重载
- 工具浮球：`z-index: 9999`
- 回顶按钮：`z-index: 90`，圆形 `40x40`，border accent，hover 填充

---

## 5. 暗色/亮色模式

### 5.1 实现方式

- 主题状态存储在 `localStorage.theme`，className：`data-theme="dark|light"` on `<html>`
- CSS 变量完整覆盖——所有颜色均通过 `[data-theme="dark"]` / `[data-theme="light"]` 切换
- 系统偏好自动检测：`@media (prefers-color-scheme: dark)` 作为默认值，手动切换覆盖系统偏好

### 5.2 过渡

```css
:root, [data-theme] {
  transition: background-color 0.3s, color 0.3s, border-color 0.3s;
}
```

### 5.3 例外

Hero 区域（`.hero`、`.hero-overlay`、`.hero-content` 及其子元素）使用硬编码颜色（`#1a1d24`、`#fff`），不受主题切换影响。这是有意设计——Hero 始终保持深色电影感，无论页面其他区域的主题。

### 5.4 开发规则

- 新组件必须使用 CSS 变量，不得硬编码颜色
- 如需添加新颜色 token，在 `index.css` 的 `:root` 和 `[data-theme="dark"]` 中同步定义
- 日期选择器/select 箭头等需要暗色模式适配的图标，在 `[data-theme="dark"]` 中覆写 SVG data URI

---

## 6. 移动端断点与响应式策略

| 断点 | 触发条件 | 主要变化 |
|------|---------|---------|
| `<=768px` | 平板/手机 | 导航栏汉堡菜单激活、桌面右侧工具栏隐藏、移动端用户区显示 |
| `<=640px` | 手机 | 根字号 15px、统计栏 2x2 网格、卡片单列、Hero 高度 50vh |
| `<=480px` | 小手机 | 导航栏紧凑 padding |
| `<=380px` | 极小屏 | 根字号 14px、安全区内边距 |

**响应式策略**：

- 网格：`auto-fill + minmax`（`repeat(auto-fill, minmax(260px, 1fr))` / `minmax(320px, 1fr)`）
- 文字：`clamp()` 动态字号（标题、Hero 内容）
- 图片：`max-width: 100%; height: auto`
- 表格：`overflow-x: auto` 横向滚动
- iOS 安全区：`env(safe-area-inset-left/right)` 用于 padding

---

## 7. 全宽背景带使用规范

### 7.1 何时使用

当页面区段需要突破 `#root` 的 `max-width: 1200px` 约束、扩展到视口全宽时使用。典型场景：

- Hero 轮播区
- 统计栏
- 全宽背景的 section（首页 intro、CTA）
- 页脚
- 全局背景元素（星空粒子、波 wave）

### 7.2 实现方式

与 `#root` 容器边距协调的两种模式：

**模式 A：负 margin 突破**（Hero / 统计栏 / 页脚）

```css
.hero {
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}
```

适用于需要从 viewport 左边缘开始的元素。对水平滚动条敏感，确保父级 `overflow-x: hidden`。

**模式 B：负 margin + offset**（Landing 容器整体外扩）

```css
.landing {
  margin-left: calc(-1 * clamp(24px, 5vw, 80px));
  margin-right: calc(-1 * clamp(24px, 5vw, 80px));
}
```

将 landing 主容器外推到视口边缘，内部组件通过 `max-width` + `margin: 0 auto` 居中。

### 7.3 内容区全宽

```css
.landing-content-sections > section {
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  padding-left: clamp(24px, 5vw, 80px);
  padding-right: clamp(24px, 5vw, 80px);
}
```

内部 padding 恢复内容区至可读宽度。

---

## 8. z-index 层级体系

| 层级 | 元素 |
|------|------|
| `10` | `#root section` / `.landing-section` 内容区玻璃层 |
| `90` | `.back-to-top` 回顶按钮 |
| `100` | `.navbar` 导航栏（默认） |
| `110` | `.scroll-progress` 滚动进度条 |
| `9998` | `.smartkb-fab` SmartKB 浮球 |
| `9999` | `.tool-fab` 工具浮球 |

---

## 9. 动画约定

| 用途 | 实现 | 时长 |
|------|------|------|
| 路由过渡 | `routeFadeIn`：opacity 0->1 + translateY(6->0) | 0.3s |
| 卡片 hover | `transform: translateY(-4px)` + box-shadow | 0.25s |
| Bug 卡片展开 | `bug-detail-in`：opacity + translateY(-4->0)，elastic easing | 0.3s |
| 时间线节点入场 | `dev-timeline-in`：stagger delay `calc(var(--idx) * 80ms)` | 0.5s |
| Hero 淡入 | `hero-subtitle-fade`：opacity + translateY(8->0)，延迟 0.8s | 1s |
| 数字滚动 | `useCountUp`：IntersectionObserver + rAF ease-out cubic | 1.5s |
| 滚动揭示 | `reveal`：opacity + translateY(24->0)，IO触发 | 0.6s |
| 浮球回顶 | `back-to-top-in`：opacity + translateY(8->0) | 0.3s |

---

> 本规范基于 Oxelia51 前端实际代码提取，任何新增 UI 元素应遵循以上约定。变更设计 token、断点或 z-index 体系属于架构决策，需上报架构智能体裁定。