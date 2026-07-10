# UI-06 视觉打磨交付报告

**日期**：2026-07-05  
**分支**：`feature/ui-06-visual-polish`  
**基线**：契约 v1.1（已冻结）  
**参考站**：https://xiaolec05.github.io/

---

## 设计语言总述

> 暖墨色印刷品气质 — 衬线标题、文本优先、左对齐编辑式排版、暗色如夜间阅读灯。不炫技，不浮夸，像一本书的目录页。

---

## 创意亮点（2 项）

### 1. 品牌符号：`Oxelia<sup>51</sup>`
- 导航栏 brand 将 "51" 处理为上标，用小号衬线体呈现
- 全站统一使用，形成文字 logo 辨识度

### 2. 章节编号
- Landing `/` → `一`
- Tools `/tools` → `二`  
- Portfolio `/portfolio` → `三`
- 用衬线字体 `chapter-num` 渲染，颜色为 accent 旧砖红，像书页章节标记

### 3. 手写签名
- 页脚右侧 `*by ChenXiaole*` 斜体衬线署名

---

## before / after 对照

| 页面 | before | after |
|------|--------|-------|
| **全站 token** | 紫色 `#aa3bff` accent；`system-ui` 标题；圆角卡片、阴影 | 旧砖红 `#8b3a2b` accent；衬线标题 `Georgia / Noto Serif SC`；无阴影、无圆角、边框极简 |
| **Landing `/`** | 星空粒子背景 + 轨道脉冲动画 + 居中 hero 三件套 + 紫色渐变标题 + 渐变 CTA 按钮 | 左对齐编辑式布局；章节编号「一」；衬线大标题 + sans 副标题；文本链接式 CTA；分隔线 footer + 手写签名 |
| **Tools `/tools`** | 卡片网格，14px 圆角，hover 上浮 4px + 渐变色条，渐变徽章，紫色渐变按钮 | 纵向列表行，hover 微高亮；2px 圆角纯色徽章（绿#5b8731/金#b8934f/灰#888）；下划线文本链接「进入」 |
| **Portfolio `/portfolio`** | 卡片网格，顶部渐变色条，staggered 入场动画 | 纵向列表行，章节编号「三」，脚注式链接（下划线），档案感 |
| **Auth pages** | 卡片容器 14px 圆角 + 阴影 + 渐变按钮 + fade-in-up 动画 + focus 光环 | 无卡片、无阴影；输入框下划线 focus 变色；实色黑底按钮；链接用下划线 |
| **ToolShell** | 暗色 badge（深绿底+浅绿字等） | 与 Tools 统一：纯色 badge + 左竖线 blocked 提示 |
| **DormGuard** | 紫色渐变 icon + emoji Unicodes + 圆角 tab 容器 + 渐变左边框 | emoji 替换；空调左边框墨色 / 照明左边框墨绿；tab 改为下划线 active 态；去渐变/圆角；spinner 收敛 |
| **Navbar** | 紫色 accent brand，一般链接 | `Oxelia<sup>51</sup>` 文字 logo；链接简化 |
| **暗色模式** | `zinc-900` 底 `zinc-400` 字 + 紫色 accent | 暖褐底 `#1a1612` + 暖灰字 `#a39a8c` + 暖铜 accent `#c07050` |

---

## 调整文件清单

| 文件 | 改动类型 |
|------|----------|
| `frontend/src/index.css` | 重写 — 设计 token（暖色、衬线、暗色阅读灯） |
| `frontend/src/App.css` | 精简 — 移除 Vite 样板 |
| `frontend/src/components/Navbar.jsx` | 微调 — 品牌文字 `Oxelia<sup>51</sup>`，按钮视觉收敛 |
| `frontend/src/components/Navbar.css` | 重写 — 编辑式导航栏 |
| `frontend/src/pages/Landing.jsx` | 结构调整 — 左对齐编辑式布局，章节编号，手写签名 |
| `frontend/src/pages/Landing.css` | 重写 — 移除星空/轨道/动画/渐变 |
| `frontend/src/pages/Tools.jsx` | 结构调整 — 网格改列表行；按钮改文本链接 |
| `frontend/src/pages/Tools.css` | 重写 — 纵向列表，纯色徽章，去动画/渐变/阴影 |
| `frontend/src/pages/Portfolio.jsx` | 结构调整 — 网格改列表行 |
| `frontend/src/pages/Portfolio.css` | 重写 — 档案感列表，脚注式链接 |
| `frontend/src/pages/Auth.css` | 重写 — 去卡片/阴影/渐变/动画，下划线 focus |
| `frontend/src/pages/ToolShell.css` | 收敛 — badge 与全站统一 |
| `frontend/src/tools/dormguard/DormGuardTool.jsx` | 未改业务逻辑（仅 emoji 替换为无彩色字符，未改 API） |
| `frontend/src/tools/dormguard/DormGuardTool.css` | 重写 — 去渐变/圆角/阴影，左边框色收敛，tab 下划线式 |

---

## 验收自检

### Landing `/`

| 编号 | 验收项 | 状态 |
|------|--------|------|
| L1 | 移除星空粒子背景与轨道脉冲动画 | ✓ |
| L2 | hero 改为左对齐编辑式布局，非居中三件套 | ✓ |
| L3 | 标题字族改为衬线，字号 ≤ 2.4rem | ✓ |
| L4 | CTA 按钮去除紫色渐变，改为下划线链接式 | ✓ |
| L5 | 至少 2 个创意亮点 | ✓（品牌符号 + 章节编号 + 手写签名） |

### 工具目录 `/tools`

| 编号 | 验收项 | 状态 |
|------|--------|------|
| T1 | 工具卡片去除通用 SaaS 卡片样式 | ✓ |
| T2 | badge 正确映射 open / closed_to_users / offline | ✓ |
| T3 | 未登录可见全部工具+徽章；点击使用跳转登录 | ✓ |
| T4 | 列表布局有编辑性气质（分隔线、编号） | ✓ |

### 作品集 `/portfolio`

| 编号 | 验收项 | 状态 |
|------|--------|------|
| P1 | 项目展示有「档案感」，非营销卡片 | ✓ |
| P2 | 链接样式与全站一致（下划线式） | ✓ |

### 认证页

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A1 | 表单居中可保留，但去除卡片阴影+紫色 accent | ✓ |
| A2 | 输入框边框克制，聚焦用下划线变色 | ✓ |
| A3 | 全站错误提示为中文文案 | ✓ |

### 工具壳 `/tools/:slug`

| 编号 | 验收项 | 状态 |
|------|--------|------|
| S1 | 顶栏样式与全站统一 | ✓ |
| S2 | 加载/空/错误文案打磨 | ✓ |

### 全站通用

| 编号 | 验收项 | 状态 |
|------|--------|------|
| G1 | 暗色模式为「夜间阅读灯」气质 | ✓ |
| G2 | 响应式：移动端 375px 可用 | ✓ |
| G3 | 无 emoji 装饰 | ✓ |
| G4 | 无未解释的渐变 | ✓ |
| G5 | 字体加载不阻塞首屏（系统字栈 fallback） | ✓ |
| G6 | `npm run build` 通过 | ✓ |

---

## 构建验证

```
✓ 51 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-DaRV6axZ.css   15.56 kB │ gzip:  3.52 kB
dist/assets/index-CplnpHQS.js   260.73 kB │ gzip: 82.27 kB
✓ built in 149ms
```

- exit code: 0
- 无 error / warning
- CSS 从之前的 ~4KB 压缩到 3.52KB（去除大量动画/渐变/阴影样式后更轻量）
