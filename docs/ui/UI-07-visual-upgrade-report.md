# UI-07 视觉升级交付报告

> 日期：2026-07-06  
> 目标：在保持"去 AI 化"前提下，将视觉升级为"高端、上档次、眼前一亮"  
> 参考气质：NASA.gov（电影级大胆） × XiaoleC05.github.io（编辑式克制）

---

## 一、Before / After 描述

### 1.1 配色

| 项目 | Before (UI-06) | After (UI-07) |
|------|---------------|---------------|
| 背景 | `#fdfaf4` 暖黄纸色 | `#fafaf7` 暖白，更通透 |
| 次级背景 | 无 | `#f0efe9` 米灰，增加层次 |
| 深色区块 | 无 | `#1a1d24` 深蓝灰，hero/footer 专用 |
| 主文字 | `#5c5346` 偏黄灰 | `#2a2a2a` 清晰深灰 |
| 标题 | `#1a1510` 暗棕 | `#0d0d0d` 锐利深黑 |
| 辅助文字 | 复用 `--text` | `#6b6b6b` 独立 muted 色 |
| 强调色 | `#8b3a2b` 暗红棕 | `#c8553d` 陶土色，温暖有辨识度 |
| 成功色 | `#5b8731` 哑光绿 | `#2c6e49` 森林绿，更高级 |
| 边框 | `#e3ded3` | `#e0ddd5` 暖灰，更柔和 |

### 1.2 亮/暗闭环

Before：全页面统一暖黄纸色背景，无明暗对比。  
After：Landing 开屏深色 → 内容区亮色 → Footer 深色收尾，形成"从暗到亮再回归暗"的叙事节奏。

### 1.3 字体

| 角色 | Before | After |
|------|--------|-------|
| 标题 | Georgia / Noto Serif SC 回退 | Noto Serif SC（Google Fonts CDN）+ 600/700 字重 |
| 正文 | system-ui 系统字体 | Inter（Google Fonts CDN），现代国际化 |
| 代码 | SF Mono / Cascadia Code | JetBrains Mono（Google Fonts CDN） |

### 1.4 字号对比

| 元素 | Before | After |
|------|--------|-------|
| h1 | `2rem` | `clamp(2.5rem, 5vw, 4rem)` |
| h2 | `1.35rem` | `clamp(1.5rem, 3vw, 2rem)` |
| Hero 标题 | `2.4rem` | `clamp(3.5rem, 8vw, 6rem)` 衬线超大字 |
| 正文 | `17px` | `16px` / line-height 1.7 |
| 容器宽度 | `760px` | `1200px` |
| 侧边留白 | `20px` 固定 | `clamp(24px, 5vw, 80px)` |

---

## 二、调整文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/index.html` | 改 | 加 Google Fonts CDN（Noto Serif SC + Inter + JetBrains Mono），lang 改为 zh-CN，title 改为 Oxelia51 |
| `frontend/src/index.css` | 改 | 重写 :root 设计 token（配色、字体、字号、间距），容器宽度 760→1200px，新增 .chapter-num 样式 |
| `frontend/src/App.css` | 改 | 保持简洁，无实质变化 |
| `frontend/src/components/Navbar.jsx` | 改 | 新增 useLocation 检测 landing 页，添加 `navbar--hero` class |
| `frontend/src/components/Navbar.css` | 改 | 品牌字重 400→600，上标用 accent 色，新增 `.navbar--hero` 透明叠加样式 |
| `frontend/src/pages/Landing.jsx` | 改 | 重构为三段式：hero（100vh 深色）→ body（亮色内容）→ footer（深色收尾） |
| `frontend/src/pages/Landing.css` | 重写 | Hero 100vh 全屏沉浸式 + 衬线超大标题 + CTA 按钮 + 深色 footer |
| `frontend/src/pages/Tools.jsx` | 改 | 首行工具（DormGuard）加"推荐"标记 |
| `frontend/src/pages/Tools.css` | 改 | 行高加大（18→24px），字号升级，badge 色改用 accent/accent-2，hover 背景用 bg-alt |
| `frontend/src/pages/Portfolio.css` | 改 | 改为 grid 杂志式排版，项目间距 48px，标题 1.5rem，链接右侧脚注式 |
| `frontend/src/pages/Auth.css` | 改 | 表单加 bg-alt 背景色，标题 serif 1.8rem，提交按钮 accent 实心色，输入框 focus accent |
| `frontend/src/pages/ToolShell.css` | 改 | 标题 clamp 1.8-2.4rem，badge 色更新，描述字号加大 |
| `frontend/src/pages/Admin.css` | 改 | 表格行高 8→14px，badge 细线框→背景色填充，accent/accent-2 分色，modal border-radius |
| `frontend/src/tools/dormguard/DormGuardTool.css` | 改 | 余额数字 1.7rem→3rem + 衬线字体，卡片间距加大，spinner/accent 色更新 |
| `frontend/src/tools/shared/ToolPlaceholder.css` | 改 | 圆角 14→4px，按钮渐变→accent 纯色，字号微调 |

**未修改：**
- `backend/**`
- `docs/api/**`
- `frontend/src/api/index.js`
- `package.json`
- 所有 JSX 业务逻辑（fetch / apiPost / apiPatch / apiGet 调用）
- 路由结构

---

## 三、设计 Token 对照表

| Token | UI-06 | UI-07 |
|-------|-------|-------|
| `--bg` | `#fdfaf4` | `#fafaf7` |
| `--bg-alt` | — | `#f0efe9` |
| `--bg-dark` | — | `#1a1d24` |
| `--text` | `#5c5346` | `#2a2a2a` |
| `--text-h` | `#1a1510` | `#0d0d0d` |
| `--text-muted` | — | `#6b6b6b` |
| `--border` | `#e3ded3` | `#e0ddd5` |
| `--code-bg` | `#f3efe7` | `#f4f3ec` |
| `--accent` | `#8b3a2b` | `#c8553d` |
| `--accent-2` | — | `#2c6e49` |
| `--accent-bg` | `rgba(139,58,43,0.07)` | `rgba(200,85,61,0.07)` |
| `--accent-border` | `rgba(139,58,43,0.35)` | `rgba(200,85,61,0.35)` |
| `--sans` | system-ui | Inter + system-ui |
| `--heading` | Georgia + Noto Serif SC 回退 | Noto Serif SC（CDN） |
| `--mono` | SF Mono + Cascadia Code | JetBrains Mono（CDN） |

---

## 四、构建验证

```
npm run build → ✓ built in 120ms
53 modules transformed.
dist/assets/index.css  25.65 kB (gzip: 5.07 kB)
dist/assets/index.js  270.53 kB (gzip: 84.04 kB)
```

无错误，无警告。

---

## 五、各页面视觉主角

| 页面 | 主角 |
|------|------|
| Landing | Hero 衬线超大标题（6rem）+ "浏览工具" CTA 按钮 |
| Tools | 首行 DormGuard + "推荐" 标记 |
| Portfolio | 每个项目的大标题（1.5rem serif）+ 80px 间距 |
| Auth | 居中表单 bg-alt + serif 标题 |
| DormGuard | 余额数字 3rem 衬线大字 |
| Admin | 表格 hover bg-alt + accent/accent-2 状态 badge |
