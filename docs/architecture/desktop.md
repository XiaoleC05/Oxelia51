# desktop — Tauri 2 桌面应用

**模块路径**：`desktop/` | **技术栈**：Tauri 2（Rust 壳）+ React 19 + Vite 7 + Go sidecar

本地优先的个人 Token 记账本桌面端。壳托管一个 Go sidecar（proxy-gateway 本地模式，`127.0.0.1:17800`），UI 通过 HTTP 轮询 sidecar 的 `/api/*` 读取统计与设置。sidecar 本身的架构见 [proxy-gateway.md](proxy-gateway.md)。

---

## 1. 模块职责

- **Rust 壳**（`src-tauri/`）：窗口管理（主窗口 + 悬浮卡片）、系统托盘驻留、sidecar 生命周期、独立后台代理管理（方案 C）、系统通知与外链打开；
- **UI**（`desktop/ui/`）：统计展示（7 个页签）、设置编辑、悬浮统计卡片、更新检查、云同步入口；
- **sidecar**：编译产物内嵌打包（Tauri `externalBin`），提供代理转发 + SQLite 落账 + localapi。

刻意不引入路由库与状态库：单窗口 7 页签用 `useState` 切换，数据流是「轮询 sidecar → setState」，复杂度不需要更多工具。

## 2. 目录结构

```
desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           ← 薄入口（调 lib.rs run()）
│   │   ├── lib.rs            ← 壳核心：setup、托盘、窗口事件、sidecar 托管、manage_proxy 命令
│   │   └── proxyctl.rs       ← 独立后台代理（方案 C）：安装/自启/端口探测/版本比对
│   ├── tauri.conf.json       ← 双窗口声明、CSP、externalBin、NSIS 打包配置
│   ├── Cargo.toml            ← 版本号四件套之一
│   ├── capabilities/         ← Tauri 权限声明
│   ├── binaries/             ← externalBin 占位
│   └── proxy-x86_64-pc-windows-msvc.exe  ← 本地开发用 sidecar（CI 构建时重新生成）
├── ui/
│   ├── index.html            ← 主窗口入口
│   ├── widget.html           ← 悬浮卡片入口（独立 Vite 页面）
│   └── src/
│       ├── App.tsx           ← 主界面：页签导航、自绘标题栏、主题切换、轮询编排
│       ├── api.ts            ← sidecar HTTP 客户端（API_BASE = http://127.0.0.1:17800）
│       ├── version.ts        ← APP_VERSION + GitHub Releases 更新检查
│       ├── screens/          ← 7 个页签组件（OverviewTab/ConnectTab/ProvidersTab/
│       │                        AgentsTab/AlertsTab/ModelPriceTab/SettingsTab）
│       ├── components/       ← Dropdown 等共享小组件
│       ├── widget/           ← 悬浮卡片（WidgetApp.tsx + widget.css，轮询 2.5s）
│       ├── styles/
│       │   ├── oxelia51-theme.css  ← 双主题变量（cozy/cosmos，复制自 web 自包含）
│       │   ├── global.css          ← 全局样式 + zoom 整页缩放（--ox-font-scale）
│       │   └── app/                ← 主界面 12 个模块 CSS（app.css 按序 @import）
│       └── assets/           ← 品牌 logo（明暗两套）
└── scripts/                  ← 本地构建/打包辅助脚本
```

## 3. 壳架构（`src-tauri/src/lib.rs`）

```
run()
 ├─ plugin: single-instance（win/linux；macOS 靠系统激活机制）
 ├─ plugin: notification（#27：WebView2 的 Web Notification 不可靠）
 ├─ plugin: opener（#29：外链交系统浏览器）
 └─ setup()
     ├─ ensure_independent_proxy()   ← 方案 C：已开独立代理则确保其运行且版本最新
     ├─ spawn_sidecar()              ← 端口探测 17800，被占则复用；否则启动子进程
     ├─ set_theme(Light)             ← 原生菜单统一浅色
     ├─ macOS: 恢复 decorations + Overlay 标题栏（保留交通灯）
     └─ 系统托盘：左键/「打开」唤出窗口；「退出」置 QUIT 才真正退出
```

### 3.1 sidecar 托管与端口复用

`find_sidecar` 解析顺序：`OXELIA_SIDECAR` env → Tauri 资源目录（打包后 externalBin 位置，Windows 为 `proxy.exe`）→ exe 同目录 / `../sidecar` 等开发布局候选。

`spawn_sidecar` 启动前先用 500ms 超时的 TCP 连接探测 `127.0.0.1:17800`：已有 sidecar 在跑（独立后台代理 / 另一实例残留）则**复用**而非再起一个（否则 bind 冲突静默失败，UI 显示「代理离线」）。启动时注入 `LOCAL_MODE=true PROXY_PORT=17800`；Windows 加 `CREATE_NO_WINDOW` 防弹控制台窗口。

**托盘驻留**：关窗 = `hide()` + `prevent_close()`，`RunEvent::ExitRequested` 一律 `prevent_exit()`，只有托盘「退出」（`QUIT=true`）才真正退出并在 `RunEvent::Exit` 杀掉自持的 sidecar 子进程（锁毒化也经 `PoisonError::into_inner` 强制清理，避免孤儿进程）。

### 3.2 独立后台代理「方案 C」（`proxyctl.rs`）

让代理**独立于应用存活**：应用彻底退出后代理仍运行，下次打开经端口探测复用。所有权不变式：独立模式 ON 时应用持有 `None`（外部进程，退出不杀）；OFF 时持有自己的 `Child`（退出即杀）。

- **安装目录**（版本不同才复制，比对跑 `-version` 的输出）：
  - Windows：`%LOCALAPPDATA%/Oxelia51/proxy/proxy.exe`
  - macOS：`~/Library/Application Support/Oxelia51/proxy/proxy`
  - Linux：`~/.local/share/oxelia51/proxy/proxy`
- **开机自启**：Windows 注册表 `HKCU\...\Run\Oxelia51Proxy`；macOS LaunchAgent plist（`com.oxelia51.proxy`）；Linux `~/.config/autostart/oxelia51-proxy.desktop`。启动参数均为 `--local --port 17800`。
- **进程管理**：`is_running()` TCP 探测（500ms）；`running_version()` 直接手写 HTTP/1.0 请求打 `/api/proxy/status` 解析版本（不引 HTTP client 依赖）；`kill_listener(port)` 跨平台按端口杀进程（Windows 用 PowerShell `Get-NetTCPConnection` + `taskkill /F`，其余 `lsof -ti` + `kill`）。
- **版本自愈**：应用启动时若自启已注册但「未运行或版本落后」→ 杀旧实例、启动安装目录里的新版本。
- 前端经 `manage_proxy {action: status|install|uninstall}` 命令操作（async，不阻塞 UI 线程）；Windows 下所有子进程调用（reg/powershell/taskkill）都套 `no_console` 防终端闪现。

## 4. 双窗口

在 `tauri.conf.json` 静态声明：

| 窗口 | 配置 | 说明 |
|------|------|------|
| `main` | 1200×800（min 720×480），`decorations: false` | 无边框自绘标题栏（Windows/Linux）；macOS 由 lib.rs 恢复原生装饰 + Overlay 标题栏 |
| `widget` | 340×300，`transparent + alwaysOnTop + skipTaskbar + shadow:false`，初始 `visible:false` | 悬浮统计玻璃卡片，加载 `widget.html` |

主窗口顶栏（`App.tsx`）：拖曳区仅限两段 `.drag-spacer` 占位条（`data-tauri-drag-region`）——`.tabs` 页签栏带横向滚动条，整栏拖曳会劫持滚动条拖动；drag-spacer/顶栏空白双击切最大化，启动 800ms 内忽略双击（双击图标启动时第二击可能落在顶栏的保护）；右上自绘最小化/最大化/关闭三键（macOS 保留交通灯不渲染自绘键，浏览器 dev 模式整组隐藏）。「代理离线」状态徽章可点击 → 跳设置页滚动到代理区块。

悬浮卡片（`widget/WidgetApp.tsx`）：轮询 `/api/overview`（2.5s，比主界面 5s 更密），显示今日 Token/成本/请求数/模型 Top5，显示字段由设置页 `widgetFields` 控制；窗口位置拖拽后持久化到 sidecar settings（`widget_pos`）重启恢复。浏览器 dev 模式下「悬浮统计」按钮退化为 `window.open` 小窗预览。

## 5. UI 架构（`desktop/ui/src/`）

- **页签导航**：`App.tsx` 内 `TabKey` 七选一（总览/接入/供应商/Agent/告警/模型价格/设置），`useState` 切换，`<main key={tab}>` 强制重挂载。无路由库。
- **数据流**：`api.ts` 封装对 `http://127.0.0.1:17800` 的 fetch（类型与 localapi 响应一一对应）；总览数据由 App 持有（5s 轮询 + `/api/health` 探活），其余页签各自轮询。无全局状态库。
- **双主题**：`styles/oxelia51-theme.css`（复制自 web 端主题变量，桌面自包含避免依赖 web 构建），`<html data-theme="cozy|cosmos">` 驱动，默认 cosmos；切换即写 sidecar settings（`theme`）持久化。
- **zoom 缩放**：`global.css` 对 body 用 `zoom: var(--ox-font-scale, 1.3)` 整页等比放大（WebView2/Chromium 完整支持），一处调全局。
- **CSS 组织**：`app.css` 只做 12 个模块的 `@import` 聚合（titlebar/layout/overview/lists/alerts/page-head/connect/forms/pricing/banner/motion/price-table），原单文件按分节纯剪切拆分，级联行为不变。
- **辅助模块**：`openExternal.ts`（Tauri opener 插件打开外链，浏览器 dev 回退 `window.open`）、`clipboard.ts`（剪贴板 + 接入页三请求格式定义 `API_FORMATS`/`formatBaseUrl`）、`EmptyState.tsx`（空态组件）、`components/Dropdown.tsx`（共享下拉）。`screens/DateRangePicker.tsx`、`ProviderCatalog.tsx`、`CustomProviders.tsx` 为页签内复用的子组件。

## 6. 更新检查与云同步

- **更新检查**（`version.ts`）：启动时查 GitHub Releases API（`XiaoleC05/Oxelia51`），只认语义化版本 tag（`v*` 或纯数字）——CI 的 `release-*` 自动提交噪声不算版本；有新版本时按平台挑安装包直链（Win `.exe` / macOS `.dmg` / Linux `.AppImage` 回退 `.deb`），横幅点击经 `openExternal` 交系统浏览器。失败（含 API 匿名限流）静默吞掉——检查更新是锦上添花。
- **云同步客户端**：设置页登录（邮箱+密码 → `POST /api/sync/login` 拿长期 token 存 sidecar settings）后，可手动/自动触发 `POST /api/sync {action}`（sidecar 实现，见 [proxy-gateway.md](proxy-gateway.md) §6 与 [data-flow.md](data-flow.md) §3）。
- **CSP**（`tauri.conf.json`）：`connect-src 'self' http://127.0.0.1:17800 https://oxelia51.com https://api.github.com`——恰好覆盖 sidecar、云同步、更新检查三个外联面，其余一律拒绝。

## 7. 构建与发布

`.github/workflows/desktop-build.yml`（tag `v*` 或手动触发）：

```
matrix: windows-latest (nsis) / macos-14 (dmg) / ubuntu-latest (deb,rpm,appimage)
  1. Go 1.26 构建 sidecar → desktop/src-tauri/proxy-<target-triple>[.exe]
     （-ldflags 注入版本号 -X .../version.V=${tag#v}；Windows 加 -H windowsgui）
  2. Rust stable + Node 22，npm ci（ui/），tauri build --bundles ...
  3. Windows 额外打便携 zip（oxelia51.exe + proxy.exe 同目录，PowerShell Compress-Archive）
  4. 全部产物上传 artifact；tag 构建由 release job 汇总发到 GitHub Release
```

**版本号四件套**（发布时必须逐一核对，`version.ts` 头注释即清单）：

1. `desktop/src-tauri/Cargo.toml` `[package] version`
2. `desktop/src-tauri/tauri.conf.json` 顶层 `version`
3. `desktop/ui/package.json` `version`
4. `desktop/ui/src/version.ts` `APP_VERSION`

当前四处均为 `0.1.14`（sidecar 版本号独立，由 CI 从 tag 注入）。

## 8. 关键设计决策

1. **sidecar 复用优先于独占**：端口探测命中即复用，配合单实例锁（win/linux）解决「第二个实例起第二个 sidecar 端口冲突」的实测 bug。
2. **方案 C（独立后台代理）为可选增强**：默认「随应用启停」，用户在设置页显式开启后才注册自启；切换时先杀自持子进程让出 17800（开启）或立即接管（关闭），代理服务不中断。
3. **UI 零框架依赖**：无路由/状态库/组件库，依赖面只有 React 19 + Tauri API + 两个 Tauri 插件——安装包体积与供应链面最小化。
4. **主题 CSS 复制而非引用 web**：桌面端自包含（`oxelia51-theme.css` 头注明示），代价是两份文件需手动同步。
5. **关窗即驻留托盘**：记账工具的典型用法是常驻后台，「退出」入口收窄到托盘菜单。

## 9. 已知限制

- **macOS 无单实例插件**（靠系统激活机制兜底），极端情况下仍可能双实例——端口复用机制兜住了 sidecar 侧的后果。
- **版本比对的解析很朴素**：`running_version()` 手写字符串找 `"version":"`，sidecar 响应格式变化会静默失效（回退「版本不同」→ 重启 sidecar，行为仍安全）。
- **便携版 zip 无自动更新路径**：更新检查跳 GitHub Release 页手动下载。
- **CSP 写死域名**：自建部署需改 `tauri.conf.json` 重新打包（sidecar 侧 `OXELIA_SYNC_BASE` 可改，但 webview 的 CSP 不放行则连不上）。
- **主题两份拷贝**：`desktop/ui/src/styles/oxelia51-theme.css` 与 web 端主题文件手动同步，有漂移风险。
