## 前端任务：Oxelia51 品牌化定制

### 背景

`langfuse-token` 是基于 Langfuse (MIT) 二次开发的前端，部署在腾讯云 Docker，通过阿里云 Nginx 反向代理到 `https://oxelia51.com`。当前显示的是 Langfuse 默认 UI，需要替换为 Oxelia51 品牌。

平台运行状态正常（200 OK），以下均为前端源码修改。

### 修改范围——只改这些文件

| 文件 | 改动 |
|------|------|
| `web/src/pages/_app.tsx` 或 layout 文件 | 注入 ICP 备案号、公安备案、Powered by Langfuse 声明 |
| `web/public/icon.svg` | 替换为 Oxelia51 logo |
| `web/public/favicon.ico` 或对应文件 | 替换为 Oxelia51 favicon（原 `head-logo.png`） |
| `web/src/features/theming/oxelia51-theme.css` | 检查 Cozy/Cosmos 主题切换是否正常 |
| `web/src/features/theming/oxelia51-theme.ts` | 同上 |
| 国际化配置文件 | 禁用英文、强制中文 |
| `<head>` 相关组件 | title 改为 Oxelia51 |

**不得修改**：
- 后端 API 代码
- Nginx 配置
- Docker 部署配置
- 数据库

### 具体改动

#### 1. 品牌名称

- 页面 `<title>` 从 "Langfuse" 改为 "Oxelia51"
- 系统名称全局替换为 "Oxelia51"
- 浏览器标签图标使用原 oxelia51.com 的 logo（`head-logo.png`）

#### 2. ICP 备案号（必须显示在页面底部）

```html
<div class="filing-info">
  <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
    鲁ICP备2026038838号-1
  </a>
  <span>·</span>
  <a href="https://beian.mps.gov.cn/#/query/webSearch?code=37028202001309" target="_blank" rel="noreferrer">
    <img src="/gongan.png" alt="" width="16" height="16" />
    鲁公网安备37028202001309号
  </a>
</div>
```

公安备案图标文件位于原前端 `frontend/public/gongan.png`，需复制到 `web/public/gongan.png`。

#### 3. 开源声明

页面底部或关于页面标注：

```
基于 Langfuse (MIT) 二次开发
Powered by Langfuse
```

项目根目录 LICENSE 保留 MIT，注明原始版权：

```
Original work Copyright (c) 2023 Langfuse GmbH
Modified work Copyright (c) 2025 Oxelia51
```

#### 4. 语言：强制中文

- 默认语言设为中文（简体）
- 移除语言切换功能（dropdown 不显示或只有中文选项）
- 修改 i18n 配置：查找 `next-i18next` 或 `next-intl` 配置，设置 `defaultLocale: 'zh-CN'`，`locales: ['zh-CN']`

#### 5. 主题切换检查

`web/src/features/theming/oxelia51-theme.css` 和 `oxelia51-theme.ts` 中定义了 Cozy（暖色）和 Cosmos（冷色）两种主题，检查：

- 主题切换按钮是否出现在侧边栏
- 切换后 CSS 变量是否正确应用
- 切换状态是否持久化（localStorage）

#### 6. Logo 和图标

素材已放置到 `web/public/`（无需重新复制）：

| 文件 | 说明 |
|------|------|
| `web/public/icon.png` | **黄色版 logo**（侧边栏、加载页、favicon） |
| `web/public/logo.png` | **蓝色版 logo**（深色主题、登录页） |
| `web/public/gongan.png` | 公安备案图标（19KB） |

**需要做的事**：在 `<head>` 中引用 `icon.png` 作为 favicon，在侧边栏组件中引用 `icon.png` 作为 logo 图片。

### 验证

```bash
cd langfuse-token
pnpm install
npx next build  # 确认编译通过
```

本地启动后检查：
1. 页面标题显示 "Oxelia51"
2. 底部显示备案号
3. 底部显示 "基于 Langfuse (MIT) 二次开发"
4. 语言为中文，无法切换到英文
5. 主题切换 Cozy/Cosmos 正常
6. 浏览器标签图标为 Oxelia51 logo

构建 Docker 镜像后部署到腾讯云：
```bashd
docker build -f web/Dockerfile -t langfuse-token-web:latest .
docker tag langfuse-token-web:latest crpi-6hx0lh969xz92v2y.cn-chengdu.personal.cr.aliyuncs.com/oxelia51/langfuse-token:latest
docker push crpi-6hx0lh969xz92v2y.cn-chengdu.personal.cr.aliyuncs.com/oxelia51/langfuse-token:latest
```

腾讯云：
```bash
docker pull crpi-6hx0lh969xz92v2y.cn-chengdu.personal.cr.aliyuncs.com/oxelia51/langfuse-token:latest
cd /opt/langfuse && docker compose -f docker-compose.langfuse.yml up -d langfuse-web
```

### 完成标准

- [ ] 页面 title 为 "Oxelia51"
- [ ] 浏览器标签图标为 Oxelia51 logo
- [ ] 页面底部显示 ICP 备案号 + 公安备案
- [ ] 页面底部显示开源声明
- [ ] 强制中文，无可切换的英文选项
- [ ] Cozy/Cosmos 主题切换正常
- [ ] Docker 镜像构建并推送成功
- [ ] 腾讯云部署后 `https://oxelia51.com` 可访问

### 上报

完成后回报：变更摘要、截图、验证结果。
