# Oxelia51 前端全面重构方案

**版本**：v2.0 | **日期**：2026-07-21 | **状态**：待执行

> **硬约束**：全站不出现任何品牌标语/口号。Hero 区仅保留 Logo。主题切换使用纯图标按钮（无文字）。

---

## 设计四原则（CRAP）

所有前端改动必须遵循以下四项原则，违反任意一条即为不合格。

### 1. 对齐 Alignment
- 全局使用 8px 网格：所有 margin/padding/gap 为 8 的倍数（4/8/16/24/32/48/64/96）
- 页面内容最大宽度统一 1120px，左右边距统一 24px
- 同一行内元素基线对齐（`align-items: baseline` 或 `center`）
- 绝不允许元素随意居中、左飘右浮——每个元素的位置都有网格依据

### 2. 亲密 Proximity
- 相关内容间距小（`--space-sm: 8px` 或 `--space-md: 16px`），表达"我们是一组"
- 不相关内容间距大（`--space-2xl: 48px` 以上），表达"我们不一样"
- 卡片内：标题与正文距离 < 卡片间距离
- section 与 section 之间用 1px 分割线（`--border`），视觉上清晰分界

### 3. 对比 Contrast
- **大小对比**：标题 `clamp(2rem,5vw,3.6rem)` vs 正文 `15px`
- **颜色对比**：正文 `--text` vs 标题 `--text-h` vs 强调 `--accent`
- **字重对比**：标题 800 vs 正文 400 vs 标签 600
- **明暗对比**：CTA 区全宽深色渐变从浅色背景跳出
- **描边数字**：步骤编号用 `-webkit-text-stroke` 空心大字，与实心正文形成反差

### 4. 重复 Repetition
- 所有卡片使用相同的 CSS 变量：`--r`圆角、`--border`边框、`--shadow-card`阴影、`--bg-glass`背景
- 所有 section 头使用相同的 `.sec-head` 结构：kicker → h2 → p
- 所有 section 间距统一：`padding: var(--space-4xl) var(--space-lg)`
- 主题切换按钮、像素宠物、BackToTop 在所有页面位置不变
- 颜色、字体、间距全部通过 CSS 变量引用，不重复定义

---

## 〇、前置工程：代码审查与统一

> **核心原则**：先治乱，再建新。相同内容/框架使用统一结构，不允许多种写法并存。

### 0.1 全局问题扫描

| 问题 | 涉及文件 | 严重度 |
|------|---------|:--:|
| 卡片样式不统一 | Landing.css, Blog.css, Tools.css, Friends.css 各自定义卡片 | 高 |
| 按钮样式分散 | Admin.css, Auth.css, ToolShell.css 各有独立按钮类 | 高 |
| 颜色硬编码残留 | 5 个工具 CSS 文件中存在 `#xxx` 硬编码色 | 中 |
| 间距不统一 | 各页面 section 间距 40/48/60/80px 混用 | 中 |
| 字体大小混乱 | h1/h2 在不同页面有不同大小定义 | 中 |
| 空状态/加载态不一致 | 各工具页 loading/empty/error 写法各不相同 | 中 |

### 0.2 统一组件库

**在 `index.css` 中定义全局可复用的原子类**，消除各页面的重复定义：

```css
/* ===== 统一卡片 ===== */
.card {
  background: var(--bg-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
  transition: all var(--speed) ease;
}
.card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-2px);
}

/* ===== 统一按钮 ===== */
.btn { /* 基础 */ }
.btn--primary { /* accent 填充 */ }
.btn--ghost { /* 透明边框 */ }
.btn--danger { /* 危险操作 */ }
.btn--sm { /* 小尺寸 */ }

/* ===== 统一输入框 ===== */
.input { /* 底部线条风格，与 Auth 页一致 */ }

/* ===== 统一徽章 ===== */
.badge { /* 基础 */ }
.badge--ok { /* 成功/已开放 */ }
.badge--warn { /* 警告/暂未开放 */ }
.badge--off { /* 已下线 */ }

/* ===== 统一加载态 ===== */
.skeleton { /* 骨架屏 */ }
.spinner { /* 旋转加载 */ }

/* ===== 统一空状态 ===== */
.empty-state { /* 居中灰色文字 + 图标 */ }

/* ===== 统一错误状态 ===== */
.error-state { /* 红色提示 */ }
```

### 0.3 统一间距尺度

| 用途 | 值 |
|------|----|
| 页面级 section 间距 | `--space-section: 80px`（桌面）/ `48px`（移动） |
| 卡片内边距 | `--space-card: 24px` |
| 元素间基础间距 | `--space-gap: 16px` |
| 小间距 | `--space-sm: 8px` |

### 0.4 统一响应式断点

```css
/* 移动端 */ @media (max-width: 640px) { ... }
/* 平板 */   @media (max-width: 1024px) { ... }
/* 桌面 */   默认
```

### 0.5 需删除或重建的 CSS 文件

以下文件有大量重复定义，应在统一组件库建立后**重写**而非修补：

- `Landing.css`（981 行，含 281 行死代码，已恢复但需清理）
- `Admin.css`（974 行，按钮/表格/徽章与全局重复）
- `SuperReadTool.css`（1087 行，是最大的工具 CSS，大量硬编码）
- `DormGuardTool.css`（628 行）

---

## 一、双主题色彩系统

> 替换现有 `data-theme="light|dark"` 为 `data-theme="cozy|cosmos"`
> 修改位置：`frontend/src/index.css` — 全文重写 `:root` 和 `[data-theme]` 部分

### 1.1 Cozy — 温馨家庭

```css
:root,
[data-theme="cozy"] {
  /* 背景 */
  --bg: #fdf6ee;           --bg-alt: #f5ebe0;
  --bg-glass: rgba(253,246,238,0.75);  --bg-dark: #3d2e25;
  --bg-rgb: 253,246,238;   --bg-alt-rgb: 245,235,224;
  /* 文字 */
  --text: #3d2e25;         --text-h: #2a1a0e;
  --text-muted: #8b7355;   --text-on-dark: #f5ebe0;
  /* 强调 */
  --accent: #c8553d;       --accent-hover: #a04030;
  --accent-2: #6b8e5a;     --accent-bg: rgba(200,85,61,0.07);
  --accent-border: rgba(200,85,61,0.35);
  /* 边框 */
  --border: #e0d3c0;       --border-light: #ede4d4;
  /* 阴影 */
  --shadow: rgba(60,30,10,0.10);
  --card-shadow: 0 2px 16px rgba(60,30,10,0.08);
  --card-shadow-hover: 0 6px 24px rgba(200,85,61,0.12);
  /* 状态 */
  --ok: #4a7c59;           --danger: #c8553d;
  --warn: #c4943d;         --on-accent: #ffffff;
  --code-bg: #f4ede3;
  /* 形状 */
  --radius: 10px;          --radius-sm: 6px;
  --speed: 0.3s;
}
```

### 1.2 Cosmos — 星空宇宙

```css
[data-theme="cosmos"] {
  /* 背景 */
  --bg: #0a0e17;           --bg-alt: #111620;
  --bg-glass: rgba(17,22,32,0.78);  --bg-dark: #060910;
  --bg-rgb: 10,14,23;      --bg-alt-rgb: 17,22,32;
  /* 文字 */
  --text: #c9d1d9;         --text-h: #e6edf3;
  --text-muted: #6e7681;   --text-on-dark: #ffffff;
  /* 强调 */
  --accent: #7c3aed;       --accent-hover: #9d6ff5;
  --accent-2: #3b82f6;     --accent-bg: rgba(124,58,237,0.10);
  --accent-border: rgba(124,58,237,0.4);
  /* 边框 */
  --border: #1e2430;       --border-light: #252c38;
  /* 阴影 */
  --shadow: rgba(80,60,200,0.18);
  --card-shadow: 0 0 24px rgba(80,60,200,0.10);
  --card-shadow-hover: 0 0 32px rgba(124,58,237,0.18);
  /* 状态 */
  --ok: #3fb950;           --danger: #f85149;
  --warn: #d29922;         --on-accent: #ffffff;
  --code-bg: #0d1117;
  /* 形状 */
  --radius: 6px;           --radius-sm: 4px;
  --speed: 0.2s;
}
```

### 1.3 全局过渡

```css
*,
*::before,
*::after {
  transition: background-color 0.5s ease,
              color 0.5s ease,
              border-color 0.5s ease,
              box-shadow 0.5s ease;
}

/* 性能关键路径禁用过渡 */
canvas, .theme-bg, [aria-hidden="true"] {
  transition: none;
}
```

---

## 二、主题背景引擎

> **新建文件**：`frontend/src/components/ThemeBackground.jsx` + `ThemeBackground.css`
> **修改文件**：`frontend/src/App.jsx`（替换 `<BackgroundWave />` → `<ThemeBackground />`）
> **删除文件**：`frontend/src/components/BackgroundWave.jsx` + `BackgroundWave.css`

### 2.1 统一背景容器

```css
/* ThemeBackground.css */
.theme-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  /* Cozy 模式下叠加纸张纹理 */
  opacity: 1;
}
[data-theme="cosmos"] .theme-bg {
  /* Cosmos 模式下无纹理 */
}
/* 全屏纸张纹理（仅 Cozy） */
.theme-texture {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,...SVG噪声...");
}
[data-theme="cosmos"] .theme-texture {
  opacity: 0.015;
  background-image: url("data:image/svg+xml,...不同的SVG噪声...");
}
```

### 2.2 Canvas 粒子系统

两套独立的粒子系统，在 `ThemeBackground.jsx` 中根据 `data-theme` 切换。详见第八章技术规格。

---

## 三、导航栏改造

> **修改文件**：`frontend/src/components/Navbar.jsx` + `Navbar.css`

### 3.1 主题切换按钮

位置：导航栏右侧。替换现有日月图标。

| 文件 | 行 | 改动 |
|------|----|------|
| `Navbar.jsx` | 152-153 | `getInitialTheme` 返回值改为 `"cozy" \| "cosmos"` |
| `Navbar.jsx` | 155-157 | `setTheme` 逻辑不变，`data-theme` 设 `"cozy"` 或 `"cosmos"` |
| `Navbar.jsx` | 159-161 | `toggleTheme` 在 cozy↔cosmos 间切换 |
| `Navbar.jsx` | 290-291 | 按钮图标改用 🏠（cozy）/ 🌌（cosmos），加文字标签 |
| `Navbar.css` | — | 新增 `.navbar-theme-btn` 样式，圆角按钮 + 图标旋转过渡 |

### 3.2 导航栏样式

Cozy：奶油半透明玻璃 + `backdrop-filter: blur(20px)`，底部 `var(--border)` 1px 线
Cosmos：深色半透明玻璃 + `backdrop-filter: blur(24px)`，底部 `var(--accent-border)` 发光细线

### 3.3 下拉菜单

已修复过（commit `1077488`），本次需要适配两主题的 `--bg` `--text` 变量。确保 `.navbar-dropdown` 使用 `--bg-glass`。

---

## 四、首页重构（最高优先级）

> **修改文件**：`frontend/src/pages/Landing.jsx` + `Landing.css`
> **参考网站**：Linear.app（简洁工具页）、Vercel.com（产品落地页）、GitHub.com（功能展示）

### 4.1 新首页布局（告别单列）

当前首页是单列纵向排列。新布局采用**多列不对称网格**：

```
┌──────────────────────────────────────────────────────┐
│                    Hero 全屏头图                       │
│     ┌──────────────────────────────────────┐        │
│     │   品牌标识      │        │
│     └──────────────────────────────────────┘        │
├──────────────────────────────────────────────────────┤
│  WeatherBar 横条（保留现有位置）                      │
├──────────────────┬───────────────────────────────────┤
│                  │                                   │
│   统计卡片(左)    │    导览卡片(右)                    │
│   ┌────────┐     │    ┌──────┐ ┌──────┐              │
│   │ 45 天  │     │    │ 工具  │ │ 博客  │              │
│   │ 6 工具 │     │    └──────┘ └──────┘              │
│   │12 文章 │     │    ┌──────┐ ┌──────┐              │
│   └────────┘     │    │ 关于  │ │ 管理  │              │
│                  │    └──────┘ └──────┘              │
├──────────────────┴───────────────────────────────────┤
│                                                     │
│   🕐 AI 协作时间线（全宽，保留现有 DevTimeline 组件）   │
│                                                     │
├──────────────────┬───────────────────────────────────┤
│                  │                                   │
│  Bug 案例卡片     │   最新文章（新建组件）               │
│  (保留 BugCards)  │   2 篇预览卡片                     │
│                  │                                   │
├──────────────────┴───────────────────────────────────┤
│                 CTA 引导区（新建）                      │
│      "准备好探索了吗？"  [浏览全部工具]  [注册账号]      │
└──────────────────────────────────────────────────────┘
```

### 4.2 具体修改

| 文件 | 改动 | 描述 |
|------|------|------|
| `Landing.jsx` | 重构 JSX 结构 | 统计 + 导览改用 `grid-template-columns: 1fr 1fr` 双列 |
| `Landing.jsx` | 新增 `<LatestArticles />` 区块 | 取 `articles` 的前 2 篇渲染预览卡片 |
| `Landing.jsx` | 新增 `<CTASection />` 区块 | 全宽暖色/紫光渐变背景，居中文字 + 按钮 |
| `Landing.css` | 删除死代码 | 清理 `.landing-section*` `.landing-card*` `.landing-article*` |
| `Landing.css` | 新增 `.landing-grid` | `display: grid; grid-template-columns: 1fr 1fr; gap: 24px` |
| `Landing.css` | 新增 `.landing-cta` | 全宽 call-to-action 样式 |

### 4.3 Stats 统计卡片组

```jsx
// Landing.jsx 中 stats 区块改为横排卡片
<div className="landing-stats-grid">
  <div className="stat-card stat-card--uptime">  {/* 运行时长 */} </div>
  <div className="stat-card stat-card--tools">   {/* 工具数 */} </div>
  <div className="stat-card stat-card--articles">{/* 文章数 */} </div>
</div>
```

```css
/* Landing.css */
.landing-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-gap);
}
@media (max-width: 640px) {
  .landing-stats-grid {
    grid-template-columns: 1fr;  /* 移动端单列 */
  }
}
.stat-card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-card);
  text-align: center;
  transition: all var(--speed) ease;
}
.stat-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--card-shadow-hover);
}
.stat-card .stat-num {
  font-family: var(--mono);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  color: var(--accent);
}
.stat-card .stat-label {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

### 4.4 导览卡片组

```jsx
// Landing.jsx
<div className="landing-guide-grid">
  <Link to="/tools" className="guide-card">
    <span className="guide-icon">{/* SVG */}</span>
    <span className="guide-title">在线工具</span>
    <span className="guide-desc">6 个开发者工具</span>
  </Link>
  {/* 博客、关于、管理同理 */}
</div>
```

```css
/* Landing.css */
.landing-guide-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-gap);
}
@media (max-width: 640px) {
  .landing-guide-grid { grid-template-columns: 1fr; }
}
```

### 4.5 CTA 引导区

```css
/* Landing.css */
.landing-cta {
  /* Cozy: 暖色渐变 / Cosmos: 紫蓝渐变 */
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-radius: var(--radius);
  padding: 48px 32px;
  text-align: center;
  color: var(--on-accent);
}
.landing-cta h2 {
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  font-weight: 700;
  margin-bottom: 16px;
}
.landing-cta .cta-btns {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
```

---

## 五、像素风悬浮球（SmartKB Pet）

> **修改文件**：`frontend/src/components/SmartKBFAB.jsx` + `SmartKBFAB.css`
> **参考**：Claude Code 桌面宠物、Codex 图标

### 5.1 设计规格

将现有 120px 玻璃球体改为 **像素风桌面宠物**（48×48px 像素格）：

**Cozy 模式**：像素小猫 🐱
- 暖色像素（奶油色体 + 橙色斑纹 + 粉色耳朵内侧）
- 待机动画：尾巴缓慢摇摆（4 帧像素动画）
- 点击动画：跳跃（3 帧）+ 粒子飞散改为 8-bit 方块四散
- hover 动画：坐下眨眼

**Cosmos 模式**：像素宇航员 👾
- 白色宇航服 + 紫色面罩 + 蓝色背包
- 待机动画：缓慢漂浮（上下 2px + 面罩闪烁）
- 点击动画：旋转一圈 + 星星粒子
- hover 动画：挥手

### 5.2 技术方案

使用 CSS `box-shadow` 像素画法（参考 `pixelarticons` 或 `nes.css`），每个像素 = 3px。48px ÷ 3px = 16×16 像素格。

```css
/* SmartKBFAB.css */
.smartkb-fab {
  width: 48px;  /* 原 120px → 48px */
  height: 48px;
  image-rendering: pixelated;
  /* 像素边框 */
  border: 3px solid var(--text-h);
  box-shadow:
    /* 猫的像素画——用 box-shadow 逐行绘制 */
    0 0 0 var(--text-h),  /* 第1行 */
    ...
}
```

或用 **SVG 像素画**嵌入组件：
```jsx
// SmartKBFAB.jsx
const PixelCat = () => (
  <svg width="48" height="48" viewBox="0 0 16 16" shapeRendering="crispEdges">
    <rect x="4" y="2" width="2" height="2" fill="currentColor"/>
    {/* ...每个像素一个 rect */}
  </svg>
)
```

### 5.3 交互保留

- 拖动定位保留（`localStorage`）
- 点击展开 SmartKB 浮窗保留（`onToggle`）
- 首次气泡提示保留
- 粒子飞散改为 8-bit 方块（小正方形 `2×2px` 四散）

---

## 六、逐页适配方案

### 6.1 工具目录页（`Tools.jsx`）

| 操作 | 描述 |
|------|------|
| 替换卡片样式 | 使用全局 `.card` 统一类（如果工具卡片和博客卡片不一样就改为一致） |
| 工具卡片布局 | `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` |
| 徽章统一 | 使用全局 `.badge--ok` `.badge--warn` `.badge--off` |
| 搜索框 | 与 Navbar 搜索框使用相同 `.input` 样式 |

### 6.2 博客页（`Blog.jsx` + `ArticleDetail.jsx`）

| 操作 | 描述 |
|------|------|
| 文章卡片 | 使用全局 `.card`，统一圆角和阴影 |
| 文章正文 | `max-width: 680px; margin: 0 auto;` 居中阅读 |
| 代码块 | `background: var(--code-bg)`，已适配两主题 |
| 分类标签 | 统一为 accent 色小徽章 |

### 6.3 管理后台（`Admin.jsx`）

| 操作 | 描述 |
|------|------|
| 按钮 | 使用全局 `.btn--primary` `.btn--ghost` `.btn--danger` |
| 表格 | `thead sticky` + `tbody` 斑马纹，颜色走 `--bg-alt-rgb` |
| Tab 栏 | 保留下划线动画，颜色走 `--accent` |
| 弹窗 | `background: var(--bg)` + `border: 1px solid var(--border)` |

### 6.4 认证页（Auth.css + 6 个页面文件）

| 操作 | 描述 |
|------|------|
| 品牌面板 | Cozy：暖橙渐变 / Cosmos：深紫渐变（已由 Kimi Code 改造） |
| 输入框 | 底部线条风格，focus 时 `border-color: var(--accent)` |
| 按钮 | 使用全局 `.btn--primary` |
| 成功/错误 | 已改为绿色/红色 + ✓/✕ 符号，保持 |
| 移动端 | `<768px` 隐藏品牌面板，表单占满 |

### 6.5 关于页（`About.jsx`）

| 操作 | 描述 |
|------|------|
| Hero 区 | 头像 + 标题 + 简介，左右布局（桌面）|
| 技能标签 | 改为全局 `.badge` 风格 |
| 编辑按钮 | 使用 `.btn--ghost` + `.btn--sm` |

### 6.6 友链页（`Friends.jsx`）

| 操作 | 描述 |
|------|------|
| 卡片 | 使用全局 `.card`，统一 hover 效果 |
| 外链图标 | 保留 ↗ 标记 |
| 网格 | `repeat(auto-fill, minmax(280px, 1fr))` |

### 6.7 工具壳页（`ToolShell.jsx` + 5 个工具组件）

| 操作 | 描述 |
|------|------|
| 加载态 | 统一使用全局 `.spinner` |
| 空状态 | 统一使用全局 `.empty-state` |
| 错误态 | 统一使用全局 `.error-state` |
| 按钮 | 全部改用全局 `.btn` 系列 |
| 硬编码色 | 清零，全部用 CSS 变量 |
| focus-visible | 所有交互元素补充 `focus-visible` 样式 |

### 6.8 组件页

| 组件 | 操作 |
|------|------|
| `GlobalFooter.jsx` | 无需修改（使用 `--bg-alt` `--text-muted`，自适应主题） |
| `BackToTop.jsx` | 尺寸统一 44px，颜色走 `--accent` |
| `ScrollProgress.jsx` | 高度 3px，颜色走 `--accent`，已正确 |
| `Skeleton.jsx` | 无需修改 |
| `AuthBrandPanel.jsx` | 无需修改（由 Auth.css 控制颜色） |

---

## 七、SmartKB 浮窗适配

> **修改文件**：`frontend/src/components/SmartKBWidget.jsx` + `SmartKBWidget.css`

| 改动 | 描述 |
|------|------|
| 背景 | 改为 `var(--bg-glass)` + `backdrop-filter: blur(20px)` |
| 边框 | `var(--border)` + 微弱 `var(--card-shadow)` |
| 检索结果 | 左侧面板使用 `var(--bg-alt)` |
| AI 回答 | 右侧面板使用 `var(--bg-glass)`，流式文字颜色 `var(--text)` |
| 引用链接 | 使用 `var(--accent-2)` 色小标签 |
| 输入框 | 与全局 `.input` 保持统一 |

---

## 八、技术附录：Canvas 粒子系统

### 8.1 文件结构

```
frontend/src/components/
├── ThemeBackground.jsx       # 主组件，根据 data-theme 切换
├── ThemeBackground.css       # canvas 定位
├── particles/
│   ├── cozy-dust.js          # Cozy 暖光尘埃系统
│   └── cosmos-stars.js       # Cosmos 四层星空系统
```

### 8.2 Cozy 尘埃粒子规格

```
粒子数量：桌面 150 / 移动端 80
形状：圆形，radius 1-3px
颜色选取：["#f5d5a0","#e8c8b0","#d4a880","#c8a070"]
运动：vx: random(-0.1,0.1) vy: random(-0.3,-0.1) — 微微上浮
透明度：0.12-0.35，3-7s 周期正弦呼吸
光斑(blob)：8个，半径 60-120px，固定位置，模糊滤镜 blur(30px)
          颜色：暖金/暖粉，透明度 0.03-0.06
帧率：30fps（跳帧渲染）
```

### 8.3 Cosmos 星空粒子规格

```
第一层(远景)：300个，1px，纯白 #fff，透明度0.2-0.8，2-5s闪烁
第二层(近景)：80个，1.5-3px，蓝白 #c8d6ff，透明度0.4-0.9
            围绕画面中心旋转，角速度 0.05rad/s，完整一圈~120s
            鼠标视差偏移 ±3px
第三层(星云)：2000个，0.5-1px，从[紫#7c3aed,蓝#3b82f6,青#06b6d4]中随机
            静态，初始化时一次性绘制到离屏Canvas，不参与每帧重绘
第四层(流星)：每15-40s随机触发一次
            从右上到左下，持续1.5s
            白色渐变线条 + 头部3px白色光点
帧率：30fps（跳帧渲染）
离屏Canvas：第三层星云预渲染，避免每帧重绘2000个点
```

---

## 九、实现清单总汇

### P0 — 统一基建（先做）

| # | 任务 | 文件 | 负责 |
|:--:|------|------|:--:|
| 0.1 | 全局统一卡片 `.card` + 按钮 `.btn` + 输入框 `.input` + 间距变量 | `index.css` | Trae Work |
| 0.2 | 删除 `Landing.css` 死代码 281 行 | `Landing.css` | Codex→Trae |
| 0.3 | 扫描并清零所有硬编码颜色（5 个工具 CSS） | 工具 CSS 文件 | Trae Work |

### P1 — 主题系统

| # | 任务 | 文件 | 负责 |
|:--:|------|------|:--:|
| 1.1 | 重写 `index.css` 两套 50+ 变量（cozy + cosmos） | `index.css` | Trae Work |
| 1.2 | 新建 `ThemeBackground.jsx` Canvas 双模式粒子系统 | 新建 3 个文件 | Trae Work |
| 1.3 | 修改 `App.jsx` 替换背景组件 | `App.jsx` | Trae Work |
| 1.4 | 修改 `Navbar.jsx` 主题切换逻辑 + 图标 | `Navbar.jsx` | Trae Work |

### P2 — 首页重构

| # | 任务 | 文件 | 负责 |
|:--:|------|------|:--:|
| 2.1 | 重写 `Landing.jsx` 布局：双列网格 | `Landing.jsx` | Trae Work |
| 2.2 | 新建 Stats 横排卡片 + Guide 网格 + CTA 区 | `Landing.jsx` + `Landing.css` | Trae Work |
| 2.3 | 清理 `Landing.css` 死代码 | `Landing.css` | Trae Work |

### P3 — 像素宠物

| # | 任务 | 文件 | 负责 |
|:--:|------|------|:--:|
| 3.1 | 重写 `SmartKBFAB.jsx` 像素画 SVG（猫/宇航员双模式） | `SmartKBFAB.jsx` | Trae Work |
| 3.2 | 重写 `SmartKBFAB.css` 48px 像素尺寸 | `SmartKBFAB.css` | Trae Work |

### P4 — 全站统一

| # | 任务 | 文件 | 负责 |
|:--:|------|------|:--:|
| 4.1 | 逐页替换卡片为 `.card` 类，替换按钮为 `.btn` 类 | 所有页面/组件 CSS | Trae Work |
| 4.2 | 工具加载/空/错误三态统一 | 5 个工具组件 | Trae Work |
| 4.3 | 两主题下逐页检查色彩适配 | 全 CSS | Trae Work |

### P5 — 审查

| # | 任务 | 文件 | 负责 |
|:--:|------|------|:--:|
| 5.1 | 构建验证 + 全站视觉走查 | — | Trae Work |
| 5.2 | Codex 审查 + 残漏修复 | — | Codex |

---

## 十、验证标准

```bash
# 每次修改后
cd frontend && npm run build  # 零错误

# P1 完成后
# 手动验证：点击主题切换按钮 → 所有颜色 0.5s 平滑过渡 → 背景粒子切换

# P2 完成后
# 手动验证：首页双列布局在 1920/1024/768/375px 四种宽度无溢出

# P4 完成后
# 手动验证：6 个工具页加载/空/错误三种状态显示正确

# 最终验证
# 亮(Cosmos)暗(Cozy)两种模式全页面截图对比
```
