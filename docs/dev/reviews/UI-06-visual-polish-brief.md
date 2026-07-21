# UI-06：全站视觉打磨与"去 AI 化"重设计

**任务 ID**：UI-06
**角色**：Qoder Wake + GLM-5.2
**日期**：2026-07-05
**基线**：契约 v1.1（已冻结）
**参考站点**：https://xiaolec05.github.io/

---

## 1. 任务目标

对 Oxelia51 前端全站进行视觉打磨与重设计，达成三个目标：

1. **去 AI 化**：消除"AI 生成的通用 SaaS 模板"视觉特征，让界面有"作者签名感"。
2. **创意亮点**：在克制基础上加入有记忆点的设计语言，不浮夸但有个性。
3. **气质对齐参考站**：参考 xiaolec05.github.io 的文本优先、书卷气、个人博客式克制。

> 注意：参考站是"个人博客"，Oxelia51 是"工具平台"，**气质借鉴而非形态照搬**。不要把工具平台做成博客。

---

## 2. 必读文档（按顺序）

| 序号 | 路径 | 用途 |
|------|------|------|
| 1 | `docs/06-多Agent任务板.md` | 分工与可改边界 |
| 2 | `docs/07-需求确认摘要.md` | 项目定位与品牌 |
| 3 | `docs/api/platform-api.md` §4 | 工具列表 `badge` 字段语义（UI 必须正确映射） |
| 4 | `docs/api/tool-registration.md` §6 | `online_capable` / `user_accessible` / `status` 三字段语义 |
| 5 | 参考站点 https://xiaolec05.github.io/ | 视觉气质参考（在线浏览） |

---

## 3. "去 AI 化"设计指南（核心约束）

### 3.1 必须移除的"AI 生成"特征

| 特征 | 当前位置 | 移除原因 |
|------|----------|----------|
| 星空粒子背景（`radial-gradient` 多点） | `Landing.css` `.landing::before` | 通用 SaaS hero 套路 |
| 紫色渐变光晕 + 轨道脉冲动画 | `Landing.css` `.landing::after` + `@keyframes orbit-pulse` | "深空科技风"是 AI 默认审美 |
| 居中 hero 三件套（tag + h1 + 双 CTA） | `Landing.jsx` | 千篇一律的 SaaS landing |
| `fade-in-up` 入场动画 | `Landing.css` 多处 | 无意义动效，AI 通用 |
| 紫色 `#aa3bff` 作为唯一 accent | `index.css` `:root` | AI 默认配色 |
| `clamp(2.4rem, 6vw, 3.8rem)` 巨型标题 | `Landing.css` `.landing-hero h1` | SaaS hero 标准尺寸 |
| emoji / 图标卡片堆砌 | 全站审查 | AI 爱用 emoji 装饰 |

### 3.2 必须建立的"作者感"特征

| 特征 | 实施方向 |
|------|----------|
| **排版优先** | 引入衬线字体（如思源宋体 / Noto Serif SC / 系统衬线）作为标题字族；正文保留无衬线但调小字号、加宽行高 |
| **克制配色** | 主色改为墨色 / 深灰 / 米白基调；accent 改为低饱和度色（如旧砖红 #8b3a2b 或墨绿 #2f5d50），单色使用，不渐变 |
| **内容驱动布局** | Landing 改为左对齐编辑式布局（像个人博客开头），不要居中三件套 |
| **有出处的装饰** | 装饰元素必须有"理由"——分隔线、章节编号、引文符号、手写体签名等，而非抽象几何 |
| **微交互克制** | 仅在真正需要反馈处用动效（按钮按下、加载态）；移除入场动画 |
| **暗色模式自然** | 暗色不是简单反色，应像夜间阅读灯——深褐底 + 暖灰文字，而非 zinc-900 + zinc-400 |

### 3.3 创意亮点（要求至少 2 个"记忆点"）

以下方向**任选 ≥2** 实施，让站点有独特辨识度：

| 方向 | 创意示例 |
|------|----------|
| **品牌符号** | 为 Oxelia51 设计一个文字 logo 处理（如 "Oxelia51" 的 "51" 用上标 / 旧体数字 / 自定义字重），全站统一 |
| **章节编号** | 页面区块用罗马数字或汉字数字编号（一、二、三），像书页 |
| **引文气质** | 工具描述用引号包裹或左侧竖线，像编辑性内容而非营销文案 |
| **脚注式链接** | GitHub / 博客链接做成上标数字脚注样式，像学术论文 |
| **手写体签名** | 页脚用一句手写体（如 Caveat / 系统手写）签上 "by ChenXiaole" |
| **栅格留白** | 用不对称栅格（如 7:5 而非 1:1），打破对称感 |
| **极简 iconset** | 自绘 1px 线条 SVG icon 替代通用图标库 |

---

## 4. 可改文件范围

### 4.1 允许修改

| 范围 | 文件 |
|------|------|
| 全站样式 | `frontend/src/**/*.css`、`frontend/src/index.css` |
| 页面结构（微调） | `frontend/src/pages/*.jsx` |
| 组件 | `frontend/src/components/*.jsx` + `.css` |
| 工具壳样式 | `frontend/src/tools/**/*.jsx` + `.css` |

### 4.2 禁止修改（红线）

| 范围 | 原因 |
|------|------|
| `backend/**` | 后端，非 Trae 职责 |
| `docs/api/**` | 契约已冻结 |
| 前端 API 调用逻辑 | 任何 `fetch` / `axios` / `XMLHttpRequest` 调用、请求头（特别是 `Authorization`）、token 存取逻辑 |
| `frontend/src/main.jsx`、`App.jsx` 的路由结构 | 路由不可变；可改 App.css 但不可改路由表 |
| `frontend/src/tools/dormguard/DormGuardTool.jsx` 的业务逻辑 | DormGuard 工具的 API 调用与状态管理不可动；仅可改样式 |
| `package.json` 依赖列表 | **不引入新依赖**；沿用现有 React + react-router-dom + 纯 CSS |

### 4.3 需回 Cursor 确认才可改

| 范围 | 确认点 |
|------|--------|
| 任何新增页面 | 需先在 `docs/06` 增条目 |
| `badge` 字段映射逻辑 | 必须与 `platform-api §4.1` 一致，改前需对照契约 |
| 字体加载方式 | 若用网络字体（Google Fonts / 思源），需确认 CDN 策略 |

---

## 5. 逐页验收清单

### 5.1 Landing `/`（重点）

| 编号 | 验收项 |
|------|--------|
| L1 | 移除星空粒子背景与轨道脉冲动画 |
| L2 | hero 改为左对齐编辑式布局，非居中三件套 |
| L3 | 标题字族改为衬线，字号回归理性（≤ 2.5rem） |
| L4 | CTA 按钮去除紫色渐变，改为墨色实心或下划线链接式 |
| L5 | 至少包含 §3.3 中 2 个创意亮点 |

### 5.2 工具目录 `/tools`

| 编号 | 验收项 |
|------|--------|
| T1 | 工具卡片去除通用 SaaS 卡片样式（阴影 + 圆角 + hover 上浮） |
| T2 | `badge` 文案与颜色正确映射 `open` / `closed_to_users` / `offline` |
| T3 | 未登录可见全部工具 + 徽章；点击使用跳转登录（行为不可变） |
| T4 | 列表布局有编辑性气质（如分隔线、编号、引文），非均匀网格 |

### 5.3 作品集 `/portfolio`

| 编号 | 验收项 |
|------|--------|
| P1 | 项目展示有"档案感"，非营销卡片 |
| P2 | 链接样式与全站一致（脚注式 / 下划线式） |

### 5.4 验证 / 重置 / 登录 / 注册页

| 编号 | 验收项 |
|------|--------|
| A1 | 表单居中可保留，但去除卡片阴影 + 紫色 accent |
| A2 | 输入框边框克制，聚焦态用细线下划线而非粗边框 |
| A3 | 错误提示用编辑性语气（如"邮箱已被人使用"而非"EMAIL_TAKEN"） |

### 5.5 工具壳 `/tools/:slug`

| 编号 | 验收项 |
|------|--------|
| S1 | 顶栏样式与全站统一 |
| S2 | 加载 / 空 / 错误状态有文案打磨，非生硬 "Loading..." |

### 5.6 全站通用

| 编号 | 验收项 |
|------|--------|
| G1 | 暗色模式为"夜间阅读灯"气质，非简单反色 |
| G2 | 响应式：移动端 375px 宽可用 |
| G3 | 无 emoji 装饰 |
| G4 | 无未解释的渐变 |
| G5 | 字体加载不阻塞首屏 |
| G6 | `npm run build` 通过 |

---

## 6. 输出格式（Trae 交付物）

### 6.1 代码交付

- 直接在 `frontend/` 内修改，分支建议 `feature/ui-06-visual-polish`
- commit message 前缀 `style(ui):` 或 `refactor(ui):`
- 每个 commit 聚焦一个页面或一个设计系统变更

### 6.2 设计说明文档

完成后在 `docs/ui/UI-06-report.md` 写一份交付报告，包含：

```markdown
# UI-06 视觉打磨交付报告

## 设计语言总述
（一句话定义新的视觉气质）

## 创意亮点（≥2）
1. ...
2. ...

## before / after 对照
| 页面 | before | after | 说明 |
（用文字描述关键变化，附本地截图路径）

## 调整文件清单
| 文件 | 改动类型 |

## 验收自检
（§5 各页验收项逐一勾选）

## 构建验证
npm run build 结果
```

---

## 7. 约束

- **不引入新依赖**：沿用现有技术栈（React + react-router-dom + 纯 CSS）。
- **不动 API 调用逻辑**：所有 `fetch` / header / token 处理保持原样。
- **不破坏响应式**：移动端 375px 必须可用。
- **badge 映射不可变**：`open` / `closed_to_users` / `offline` 文案与 `platform-api §4.1` 严格一致。
- **构建必须通过**：交付前 `npm run build` 无 error。
- **每页改完即时自检 §5 对应验收项**。

---

## 8. 启动包（贴给 Trae）

```
你是 Oxelia51 的前端智能体 Qoder Wake + GLM-5.2（+ DeepSeek V4 Pro）。

必读（按顺序）：
1. docs/ui/UI-06-visual-polish-brief.md（本简报，核心约束）
2. docs/06-多Agent任务板.md（分工）
3. docs/api/platform-api.md §4（badge 字段语义，不可改）
4. 浏览 https://xiaolec05.github.io/ 感受气质（个人博客式克制）

任务：UI-06 全站视觉打磨 + 去 AI 化
分支：feature/ui-06-visual-polish

可改：
- frontend/src/**/*.css
- frontend/src/pages/*.jsx（结构微调）
- frontend/src/components/*.jsx + .css
- frontend/src/tools/**/*.jsx + .css（仅样式与外壳，不动业务逻辑）

禁止改：
- backend/**
- docs/api/**
- 任何 fetch / axios / 请求头 / token 逻辑
- frontend/src/main.jsx、App.jsx 的路由表
- package.json 依赖列表
- frontend/src/tools/dormguard/DormGuardTool.jsx 的业务逻辑

核心目标：
1. 去 AI 化：移除星空粒子、紫色渐变光晕、居中 hero 三件套、fade-in-up 动画、通用 SaaS 卡片
2. 气质对齐 xiaolec05.github.io：衬线标题、克制配色、内容驱动、有作者感
3. 至少 2 个创意亮点（见简报 §3.3）
4. 暗色模式做"夜间阅读灯"气质，非简单反色

完成标准：
- §5 各页验收项全部通过
- npm run build 无 error
- 交付 docs/ui/UI-06-report.md 报告
- 移动端 375px 可用

开工前先打开 frontend/src/index.css 和 frontend/src/pages/Landing.css 确认当前基线，
然后先改 index.css 的 :root 设计 token（字体、配色、间距），再逐页落地。
```

---

## 9. 后续

- Trae 交付后，由 Cursor 做"视觉一致性 + 契约边界"复核（不改样式，只验红线未越界）。
- 若涉及新增页面或字体 CDN，Trae 必须先回 Cursor 确认。
- 完成后更新 `docs/06-多Agent任务板.md` 的 UI-06 状态。
