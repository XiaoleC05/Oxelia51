# Oxelia51 前端 UI/UX 统一规范（Design System）

- 日期：2026-08-10
- 范围：**桌面应用**（`desktop/`，Tauri 2 + React）+ **网站**（`web/`，Next.js；原 langfuse-token 仓库，已并入本仓）两套前端
- 参考：结构借鉴 **Claude Design System**（tokens → 视觉基础 → 组件 → 跨组件规则 → 文件地图）。配色与功能完全保留 Oxelia51 自身。
- 性质：本文是**唯一标准**。实现与本文冲突时，以本文为准；本文缺失时，以两端现有实现中最一致的一种为准。

## 两条铁律（约定，不破）

1. **不引入新的品牌色**。一切颜色只用 `--ox-*` 变量或其派生（`color-mix`）。新增 hex 需先改 token，再引用。
2. **不删除、不弱化任何现有功能**。本规范只规定「怎么表现」，不决定「有没有」。模板没有的独有功能（悬浮卡片、四维告警、供应商目录、币种切换等）是**一等公民**，见 §4 与 §7。

---

## 一、如何使用本系统

1. **token 是唯一来源**。颜色/字体/间距/圆角/阴影一律从变量取，不在组件里写死。
   - 桌面端：`desktop/ui/src/styles/oxelia51-theme.css` + `desktop/ui/src/app.css`
   - 网站端：`web/src/features/theming/oxelia51-theme.css` + `web/src/styles/oxelia51-vars.css`（映射 shadcn）
2. **查组件**。改组件先读 §4 对应条目（解剖/变体/token 映射/结构规则）。
3. **两端差异先查 §6**。桌面端与网站有刻意差异（导航形态、密度的合理不同），也有**应对齐的漂移**；改之前先对表。

---

## 二、内容与文案准则

风格方向：**安静、克制、可信**。界面要像一本排版精良的书，而不是高能 SaaS 仪表盘。

### 语气

- 具体 > 宏大；事实 > 口号；用户价值 > 企业愿景。
- 用朴素名词与短动词，避免促销措辞与装饰性语言。
- 标题让用户**一眼知道这个页面/按钮是什么、解决什么问题**，不用抽象概念。

### 禁用词（AI 营销套话，一律不用）

赋能、引领未来、开启新时代、无限可能、重塑生态、智能化升级。

### 文案铁律

- 不生成虚假的品牌宣传语。
- 正式版不出现假数据、假截图、占位模型名。
- 信息不足先问，不自行编造。
- 空态文案必须给**行动指引**（按钮），不只写「暂无数据」。

### 示例（正确）

- 「复制地址到你的模型工具，每次调用自动记账」
- 「还没有 Token 记录——把模型工具的 BASE_URL 指向本地代理即可开始」

---

## 三、视觉基础

### 3.1 色彩

双主题 **Cozy（暖色）/ Cosmos（深色）**，由 `<html data-theme>` 驱动。tokens 见 `oxelia51-theme.css`（桌面端自包含副本，两仓必须同步）。

| 语义 | Cozy | Cosmos | 用途 |
| --- | --- | --- | --- |
| `--ox-bg` | `#faf7f4` | `#0a0a0a` | 页面底 |
| `--ox-bg-alt` | `#f3efe9` | `#141414` | 卡片/浮层底 |
| `--ox-bg-glass`（桌面专用） | `rgba(250,247,244,.75)` | `rgba(20,20,20,.78)` | 玻璃拟态（悬浮卡片/吸顶）；web 端不使用 |
| `--ox-text` | `#3a332d` | `#c9c9c9` | 正文 |
| `--ox-text-h` | `#241f1b` | `#e6e6e6` | 标题/强强调 |
| `--ox-text-muted` | `#857a6e`（桌面 `#6f6459`） | `#737373`（桌面 `#8f8f8f`） | 辅助文字，**≥4.5:1** |
| `--ox-accent` | `#e5484d` | `#e5484d` | **唯一品牌强调色**（心跳红） |
| `--ox-accent-hover` | `#dc3e42` | `#f2555a` | 主色悬停 |
| ~~`--ox-accent-2`~~ | — | — | 已废弃（两端零使用，2026-08-11 清理移除） |
| `--ox-accent-border` | `rgba(229,72,77,.35)` | `rgba(229,72,77,.4)` | 品牌描边/选中环 |
| `--ox-border` | `#e5ded4` | `#1f1f1f` | 标准描边 |
| `--ox-border-light` | `#efeae2` | `#262626` | 最浅描边 |
| `--ox-ok` / `--ox-danger` / `--ox-warn` | `#4a7c59` / `#c8553d` / `#c4943d` | `#3fb950` / `#f85149` / `#d29922` | 状态语义色 |
| `--ox-chart-1..5` | 红/橙/绿/金/棕 | 红/蓝/绿/金/灰 | 图表系列色，**chart-1 恒为品牌红** |

**用色规则**

- `--ox-accent` 只做**唯一强调**：主按钮、激活态、下钻入口、品牌装饰。大面积铺红 = 违反规范。
- 状态（在线/超限/告警）用语义色，不新造色。
- 派生一律 `color-mix(in srgb, var(--ox-accent) N%, …)`，透明度垫底/描边用同一公式，深浅主题自动协调。
- 背景色预设（`data-bg-preset` white/mist/cream/black/navy）与文字色预设（brown/ink/forest/navy）只允许**官网自定义主题**使用，应用内不启用。

### 3.2 字体

**字体栈**（两端统一，中文显式回退）：

```
--font-sans: "Manrope", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif;
```

- 品牌字标：Manrope 300 转曲（`brand-wordmark`）。
- 网站站内标题可额外用 `--font-heading: "Noto Serif SC", "Songti SC", serif`（仅站点），应用内不用衬线。
- 代码/token：`ui-monospace, "SF Mono", Consolas, monospace`。
- Manrope 无中文字形，中文回落 PingFang/雅黑；**不要再叠加其它英文无衬线字体**。

**字阶（全端统一）**

| 级别 | 字号/字重 | 用例 |
| --- | --- | --- |
| 页面标题 | 20–21px / 600 | `.page-title`，页面首行 |
| 卡片标题 | 14–15px / 600 | `.card-title`，卡片内标题 |
| 正文 | 13.5–14px / 400 | 列表、说明、正文 |
| 辅助 | 12–13px / 400 | 说明文字、时间戳、注释 |
| 大数值 | 24–31px / 600–700 | `.stat-value` 等指标大数字 |

**字重纪律**：正文 400，强调 500/600；除字标外不用 300，不用 800+。**最小字号锁 12px**（小于 12 的统计标签一律提到 12）。

### 3.3 间距

**8px 网格**：

- 组件内 8，列表项间 8–12，块间 16，卡片内 16–24，大区块 80。
- 用 Tailwind gap / 间距工具类表达（`--ox-space-*` 变量已废弃移除，2026-08-11）。
- 布局用 gap 表达间距，不用 margin 堆叠（`space-x/space-y` 类视为异味）。

### 3.4 圆角

**尺度（统一后的标准）**：

| 级别 | 值 | 用途 |
| --- | --- | --- |
| `--radius-sm` | 8px | 小控制件：按钮、徽标角、切换钮、rank-index |
| `--radius` | 10–12px | 输入、下拉触发器、Tab、日期片、图标钮 |
| `--radius-lg` | 16px | 卡片、供应商格、统计卡 |
| 浮层 | 14–16px | 下拉浮层、弹窗、托盘 |
| 站点级 | 20/24/32px | 官网落地页大表面（`--radius-xl/2xl/3xl`） |
| 全圆 | 9999px | 圆点、状态点、胶囊按钮（仅选中片） |

原则：**圆润、人文、不尖锐也不发泡**（Claude 同款精神）。下拉浮层必须是自绘圆角组件（见 §4.4），不用系统原生 select 展开。

> 注：桌面端 token 名为 `--ox-radius` / `--ox-radius-lg`；web 端映射为 shadcn `--radius-lg`（卡片 16px）、`--radius-input`（输入 10px）、`rounded-md`（按钮 8px，基准 `--radius` 10px − 2px）。`--ox-radius` 在 web 主题中已移除（web 零消费，2026-08-11），仅桌面端定义。

### 3.5 阴影

**两级即可，用于分离而非炫耀**：

| 档 | 值 | 用例 |
| --- | --- | --- |
| 静止 | 无阴影（桌面卡片）或 `0 1px 3px rgba(58,51,45,.06)`（web 卡片） | 卡片 |
| hover | `0 4px 16px rgba(0,0,0,.10)` | 可点卡片/供应商格浮起 |
| 浮层 | `0 12px 32px rgba(0,0,0,.18)` | 下拉浮层、弹窗、悬浮卡片 |

桌面端卡片静止时**无阴影、只靠描边+底色**（`--ox-bg-alt` 比底亮一档）；web 端卡片保留极轻微投影。两侧 hover 同档。

### 3.6 表面行为

- **色调分离优先于加边框**：能靠底色区分就先不叠边框。
- **避免嵌套边框**：卡片套卡片时，外层用底色、内层用浅描边，不要两层同色边框「盒中盒」。
- 卡片只在该隔离信息时引入，保持页面开敞、不密不透气。

---

## 四、组件规范

以下均为两端实际存在的组件。每条给出：解剖 / 变体 / token 映射 / 结构规则 / 用法提示 / 两端对齐。

### 4.1 按钮 Button

**解剖**：`button.root > [icon] + label`

**变体**（桌面 `.btn` / `.btn.primary`；web 映射 shadcn `Button`）：

| 层级 | 桌面实现 | 用途 |
| --- | --- | --- |
| Primary | `.btn.primary`（红底白字，hover `accent-hover`） | **每屏只一个**最强操作 |
| Secondary | `.btn`（透明底、边框，hover 变红） | 常规操作 |
| Ghost/链接 | `.link-btn`（无框红字） | 低权重操作、页内跳转 |
| Danger | `.link-btn.danger` / `.btn` + danger 色 | 删除等危险操作 |

**结构规则**

- 高度跨变体保持稳定（约 32–44px），字号 14px。
- 圆角 `--radius-sm`(8px)；主按钮不改圆角。
- 禁用态：降饱和、去阴影，但不牺牲文字可读性（`.btn:disabled`）。
- 提供者卡片里的「复制地址」是**强主按钮**（红 pill，12px/600），「官网」是**次按钮**（细边 muted），视觉权重必须明显拉开——复制 > 官网。

**用法提示**：Primary 用于真正最重要的动作；次/幽灵表面承接其余。页面里主按钮不要超过一个。

### 4.2 卡片 Card

**解剖**：`.card > .card-title + body`

**变体**：普通卡（`.card`）、统计卡（`.stat-card`）、列表卡（`.card-list`）、供应商格（`.provider-cell`）、设置分组卡。

**结构规则**

- 圆角 `--radius-lg`(16px)，1px `--ox-border` 描边，底 `--ox-bg-alt`。
- 卡片标题：14–15px/600，`--ox-text-muted`（与正文区分）。
- 统计卡可加品牌点缀：顶部 2px 红色渐变底线或 3% 红渐变底，**点缀不超过两处**。
- 可点卡片 hover：`translateY(-2px)` + `0 4px 16px` 微浮起（供应商格、list-row）。

**用法提示**：卡与卡之间 16px 间距；不要用卡片包卡片（用底色分层代替）。

### 4.3 输入与表单 Input / Form

**解剖**：`form-row > label + input(.grow) + helper`

**变体**：`.input`（普通输入）、`select.input`（原生选择）、`.dropdown`（自绘下拉，见 4.4）、`.setup-cmd`（只读命令块）。

**结构规则**

- 圆角 10–14px，描边 `--ox-border-light`（最浅），底 `--ox-bg`。
- 聚焦：描边变 `--ox-accent` + 3px `color-mix(accent 15%, transparent)` 光晕，`outline: none`。
- 原生 input/select 显式 `font-family: inherit`（否则回退 Arial）。
- 表单行用 flex + gap 对齐，`grow` 让输入占满剩余宽度。
- 错误/辅助文字贴近控件，字号 12px。

**两端对齐**：桌面已自绘 Dropdown；网站沿用 shadcn Input/Select，但聚焦环需同样换成红色光晕（`--ring` 已映射）。

### 4.4 下拉 Dropdown（独有实现，全端复用标准）

原生 `<select>` 展开面板由系统渲染成直角矩形、无法改圆角。**必须用自绘下拉**：按钮触发器 + 圆角浮层（桌面 `components/Dropdown.tsx`）。

**解剖**：`div.dropdown > button.dropdown-trigger + div.dropdown-popup`

**结构规则**

- 触发器：圆角 14px、描边 `--ox-border-light`、右侧 currentColor 旋转 chevron（`::after`）。
- 浮层：圆角 14px、1px 描边、`0 12px 32px` 阴影、max-height 300px 可滚动、padding 6px。
- 分组：`.dropdown-group-label`（12px/600 muted）+ `.dropdown-item`（9px 圆角）。
- 选中项：红色加粗；hover：`color-mix(accent 10%)` 垫底。
- 占位态类名必须用 `.dropdown-value-placeholder`，**不能叫 `.placeholder`**（会撞 `.placeholder{min-height:50vh}` 半屏占位，把下拉撑爆）。
- 关闭：点击外部或 Esc（组件内已处理）。

### 4.5 徽标与维度标签 Badge / Tag

**解剖**：`span.badge > label`

**变体**：维度徽标（`.dim-tag` 供应商/Agent 交叉标注、`.budget-dim` 告警维度）、状态点（`.status .dot`）、版本徽标。

**结构规则**

- 小而克制：12px/400，1px `--ox-border` 描边、6px 圆角、muted 文字。
- 状态点：8px 圆形，`--ox-ok`（在线，带呼吸光晕）/ `--ox-danger`（离线/超限）。
- 徽标只作注释，不与主文字抢层级。

### 4.6 导航 Navigation

两端**刻意不同**（合理差异，保留）：

| 端 | 形态 | 激活态 |
| --- | --- | --- |
| 桌面 | 顶栏 `.tabs`，56px 高，Tab 平铺 | accent 文字 + 底部 2px accent 指示条 |
| 网站 | 左侧栏（shadcn sidebar） | 左侧 3px accent 内嵌条（`box-shadow: inset 3px 0 0 var(--ox-accent)`） |

**结构规则（桌面）**

- 顶栏：品牌区（glyph + wordmark）+ 导航 + 右区（状态/主题/悬浮开关/窗口控制）。
- Tab：14px，muted；hover 提亮；激活 accent 加粗 + 2px 底线。
- macOS 交通灯占位：`padding-left: 78px` 避让。

**结构规则（网站）**：沿用 Langfuse 侧栏体系，激活项左条用品牌红。

### 4.7 列表与表格 List / Table

**解剖**：`.card-list > .list-row`（主标题 + 副标题 + 右侧数值）

**结构规则**

- 行：主标题（`--ox-text-h` 600）+ 副说明（13px muted）+ 数值（右对齐 `tabular-nums`）。
- 交叉维度用 `.dim-tag` 内联标注。
- 可点行 hover：`color-mix(accent 6%)` 垫底 + `translateX(2px)`。
- 表格（web）：表头 `--ox-bg-alt` 底，数字列 `tabular-nums`，行 hover 过渡。
- 入场：列表行错峰淡入（`rowIn`，最多 6 行延迟 0.03s 递增）。

### 4.8 指标卡 Stats

**解剖**：`.stats > .stat-card > (.stat-label + .stat-value + .stat-sub)`

**结构规则**

- 网格：4 列（≥1280px）/ 2 列（窄屏），间距 16px。
- 数值：31px/700、`tabular-nums`（数字对齐不抖动）。
- 装饰：底部 2px 红渐变线（`accent → transparent 70%`，opacity .55），每卡一处即可。

### 4.9 排行 Rank（独有视觉）

**解剖**：`.rank > .rank-row > (.rank-index + .rank-name + .rank-track + .rank-val)`

**结构规则**

- **前三名红色由深到浅**：第1 `#c03a3f` → 第2 `#d44b50` → 第3 `#e5484d`（条与序号同色系渐变），第 4 名起回主题色。
- 条形轨道 8px 高、圆角 6px，填充为红色渐变。

> 这是产品记忆点，**保留**。模板没有，不删。

### 4.10 空态 EmptyState（独有规范）

**解剖**：`.empty-state > .empty-icon + .empty-title + .empty-desc + .empty-action`

**结构规则**

- 图标：品牌伴星 glyph 弱化（48px，`opacity .12`；compact 36px）。
- 标题 15px/600 `--ox-text-h`，说明 14px muted 行高 1.6，**主按钮一个**。
- 禁止裸「暂无数据」；首启空态必须给行动路径（选供应商 + 复制地址/命令）。
- 虚线描边 + `--ox-bg-alt` 底，圆角 `--ox-radius`。

### 4.11 供应商卡片 ProviderCard（独有）

**解剖**：`.provider-cell > name + slug + actions(复制地址|官网)`

**结构规则**

- 网格 `auto-fill minmax(150px,1fr)`，gap 8px。
- 卡片 12px 圆角，hover 浮起（`-2px` + 微阴影 + accent 描边）。
- 动作优先级：**复制地址（红 pill）> 官网（细边次钮）**，必须明显。
- slug 用等宽字体 12px muted。

### 4.12 日期范围选择器 DateRangePicker

**解剖**：`.date-range-picker > .range-chip`

**结构规则**

- 容器：`inline-flex` + 3px padding + 12px 圆角 + `--ox-bg-alt` 底。
- 片：13px muted，hover 提亮；**激活片红底白字**（唯一允许的胶囊高亮）。
- 全部 / 近7日 / 近30日 / 近90日，切换联动下方统计。

### 4.13 告警与预算 Budget & Alerts（独有）

**解剖**：`.budget-list > .budget-row > (.budget-dim + .budget-model + .budget-val + .budget-tag)`

**结构规则**

- 维度徽标 `.budget-dim`（全局/供应商/Agent/模型）前缀。
- 超限态：`.budget-row.over` → 模型名变 `--ox-danger`，进度条红色渐变，`budget-tag` 红色提示。
- 四维独立设置，超限触发系统通知（桌面本地）。

### 4.14 定价表 PricingTable（独有）

**解剖**：`.price-table > .price-head-row + .price-row`

**结构规则**

- 表头 sticky（`--ox-bg-alt` 底），行网格 `1.6fr 1fr .8fr .8fr`。
- 模型名等宽 13px/600，数值右对齐 `tabular-nums`。
- 币种切换（USD/CNY）+ 汇率来源标注在表下方；价格为参考价，不虚构。

### 4.15 悬浮统计卡片 FloatingWidget（独有，桌面）

**解剖**：透明玻璃小窗（340×192，`backdrop-filter: blur(22px)`，圆角 20px）

**结构规则**

- 始终置顶、无边框、不进任务栏、可拖动；右上角 ✕ 隐藏。
- 每 2.5s 刷新，显示字段由设置页 `widget_fields` 决定（今日 Token/成本/请求数/近7日）。
- 桌面端必须放 `tauri.conf.json` 的 `app.windows` 数组（不是 `additionalBrowserWindows`），capabilities 用 `widget.json`。

### 4.16 状态提示 Status & Banner

- `.status`：状态点（ok/down）+ 文字；离线可点击跳设置排查。
- `.offline-banner` / `.update-banner`：`accent-border` 描边 + `color-mix(accent 8–10%)` 垫底，圆角 `--ox-radius`。
- 语义色只表达状态，不参与品牌强调。

### 4.17 过渡与动效 Motion

- 统一缓动：`cubic-bezier(0.4, 0, 0.2, 1)`，时长 ~0.3s（`--ox-speed`）。
- 入场：Tab 切换淡入（0.28s 上移 6px）、列表错峰、供应商格浮起。
- **必须尊重 `prefers-reduced-motion: reduce`**（桌面已做，禁用动画/过渡）。

---

## 五、跨组件规则

1. **安静层级**：层级靠字号/间距/对比度，不靠加粗堆砌。
2. **单一红色强调**：`--ox-accent` 是唯一品牌强调色，一次只强调一处主操作。
3. **色调分离优先于边框**：先底色后描边，避免「盒中盒」嵌套边框。
4. **开敞布局**：块间 16px、区块 80px，宁可留白不密排。
5. **数字一律 `tabular-nums`**：指标、排行值、价格、时间戳、成本。
6. **最小字号 12px**：辅助文字不得更小。
7. **禁用态降级**：降饱和、去阴影，不牺牲可读性。
8. **状态色不越权**：ok/danger/warn 只表状态，不冒充品牌色。
9. **空态给行动**：任何空态都带一条可操作路径。
10. **两端一致优先**：同一组件在桌面与网站的圆角/字号/强调方式一致，除非 §6 标注为「刻意差异」。

---

## 六、桌面端 ↔ 网站 差异对齐表

两端**共享同一套 `--ox-*` token**，但部分视觉落地存在漂移。下表给出唯一标准（对表改，不改色、不改功能）：

| 维度 | 桌面端现状 | 网站现状 | 统一标准 | 是否改 |
| --- | --- | --- | --- | --- |
| 卡片圆角 | `--ox-radius-lg` 16px | shadcn Card `rounded-lg` = `--radius-lg` 16px | 16px 两端一致 | ✅ 已对齐 |
| 卡片阴影 | 静止无阴影，hover `0 4px 16px` | 静止 `0 1px 3px`，hover 浮起 | 静止可无/微影，hover 同档 `0 4px 16px` | ✅ 已一致（微影属合理差异） |
| 按钮圆角 | `.btn` 8px | shadcn Button 8px | 8px | ✅ 已一致 |
| 输入圆角 | `.input` 10px / 下拉 14px | shadcn Input 经 `--radius-input` 10px | 10–14px | ✅ 已对齐 |
| 聚焦环 | 3px `color-mix(accent 15%)` 光晕 | `--ring` 已映射 accent | 红色光晕两端统一 | ✅ 已一致 |
| 页面标题 | `.page-title` 21px/600 | 站点 Tailwind `text-2xl~4xl` + 覆盖 | 站点比应用大一档属合理（营销页） | ✅ 刻意差异 |
| 卡片标题 | `.card-title` 15px/600 | shadcn CardHeader 默认 | 14–15px/600 | ✅ |
| 下拉 | 自绘 Dropdown（14px 浮层） | shadcn Select（oxelia51 面已全换；Langfuse 核心移动端 Tab 保持原生） | oxelia51 面一律自绘圆角浮层；Langfuse 核心 `sm` 以下隐藏的移动端 Tab 切换保持原生（桌面不可见，移动端 OS 选择器体验更佳） | ✅ 已对齐（`ProxyAccessSettings` 已换 shadcn Select；Langfuse 核心为刻意差异） |
| 导航 | 顶栏 tabs + 2px 底线 | 侧栏 + 3px 左条 | 各端形态保留，激活强调同用 accent | ✅ 刻意差异 |
| 空态 | `.empty-state` 三件套 | `ProxyAccessEmptyState` / `WelcomeCard` | 图标+标题+说明+主按钮 | ✅ 已一致 |
| 状态色 | `--ox-ok/danger/warn` | 同一 token 映射 | 一致 | ✅ |
| 等宽数字 | `tabular-nums` 局部 | 表格整体 `tabular-nums` | 数字列一律等宽 | ✅ |

> 标准：**两端色彩 token、圆角尺度、字号阶梯、强调方式一致**；导航形态（顶栏 vs 侧栏）与页面密度（营销页可更开敞）是刻意差异，保留。

---

## 七、文件地图

### 桌面端 `Oxelia51/`

| 用途 | 位置 |
| --- | --- |
| 主题 tokens | `desktop/ui/src/styles/oxelia51-theme.css` |
| 全局样式（字体/基类） | `desktop/ui/src/styles/global.css` |
| 组件样式 | `desktop/ui/src/app.css` |
| 自绘下拉组件 | `desktop/ui/src/components/Dropdown.tsx` |
| 悬浮卡片 | `desktop/ui/src/widget/*` + `desktop/src-tauri/tauri.conf.json`(`app.windows`) + `desktop/src-tauri/capabilities/widget.json` |
| 各 Tab | `desktop/ui/src/screens/*.tsx` |
| 设计文档 | `docs/archive/4-detailed-design.md`、`docs/archive/ui-optimization-desktop.md`、本文 |

### 网站端 `web/`

| 用途 | 位置 |
| --- | --- |
| 主题 tokens | `web/src/features/theming/oxelia51-theme.css` |
| shadcn 变量映射 | `web/src/styles/oxelia51-vars.css` |
| 站点/工作台组件 | `web/src/features/oxelia51/components/**` |
| 云同步/站点内容/站点统计/管理台鉴权 | `web/src/features/oxelia51/server/`（`syncStore` / `syncRouter` / `siteContentRouter` / `siteStatsRouter` / `adminAuth`）+ `web/src/pages/api/sync/*` |
| 应用页 | `web/src/pages/app/*`（overview / analytics / agents / providers / settings；index 重定向 overview） |
| 落地页/文档/下载 | `web/src/pages/`（LandingPage / docs / download / changelog） |
| 字体变量 | `web/src/styles/globals.css`（`--font-sans` 等） |

> 主题 tokens 在两仓**各有一份副本**（桌面自包含，避免依赖 web 构建）。改 token 必须两处同步。

---

## 八、红线（不做什么）

1. 不改 `--ox-*` 配色体系；不引入 Claude 的 terracotta / 米纸 / 衬线正文等模板色。
2. 不引入模板的字体（Newsreader/Poppins/Lora）——我们只用 Manrope + 中文字体栈。
3. 不删除任何现有功能；悬浮卡片、四维告警、供应商目录、币种切换、排行红高亮等**独有功能**保持一等地位。
4. 不使用假数据/假截图；空态不写占位模型名。
5. 不被「营销化」——按 §2 文案准则。

> 本文结构借鉴 Claude Design System（tokens → 视觉基础 → 组件 → 跨组件规则），仅借其**组织方法论**，不借其色彩与字体。
