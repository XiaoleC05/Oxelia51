# 当前服务状态

> 最后更新：2026-08-07 02:00

## 安全修复部署（2026-08-07 02:00，审查发现全部修复）

- ✅ **HIGH：IP 白名单 X-Forwarded-For 伪造** —— 已修复并部署三层
  - nginx /api/ 覆盖 `X-Oxelia51-Client-IP $remote_addr`（阿里云已应用+重载）
  - Go clientIP/forwardedClientIP 优先读可信 X-Real-IP（新二进制已部署，md5 fefaffd1）
  - web clientIpFromHeaders 优先 x-real-ip（新镜像已部署）
  - **验证**：全伪造头（X-Real-IP/X-Oxelia51-Client-IP/XFF）→ 返回真实出口 IP 218.200.225.186
- ✅ **MEDIUM**：/admin whoami staleTime:0（防换账号缓存命中）+ 校验失败重试；proxyKeyRouter create/remove 仅限 Owner/Admin
- ✅ **LOW**：whitelistCreate IP/CIDR 格式校验；sticky 偏移对齐 h-14
- ✅ 提交：Oxelia51 `213b95a`（Go+nginx）、langfuse-token `595e145`（web）

## 单管理员体系上线（2026-08-07 00:30，commit 4cb65c8 已部署）

- ✅ **唯一管理员 postmaster@oxelia51.com**：硬编码超级管理员（写操作仅其可执行，读操作管理员可见）
- ✅ 生产 `OXELIA51_ADMIN_EMAILS=postmaster@oxelia51.com`（原 714085964@qq.com 已移除权限）
- ✅ **postmaster 已注册为站点用户**（email_verified 已设，可登录），初始密码见运维记录（建议登录后修改）
- ✅ 独立管理员登录页 `/auth/admin`（极简：邮箱+密码+登录+返回，无营销/介绍语句）；普通登录页仅留「我是管理员」小入口
- ✅ 页脚精简为两行（logo+链接 / 备案），删除 slogan 与装饰文字
- ✅ 管理台桌面左导航 + 移动端横滚 Tab；用户管理仅展示，无增删管理员 UI
- ✅ 代码审查：9 发现，1 确认 HIGH（**IP 白名单 X-Forwarded-For 伪造可绕过命令执行校验**，既有问题，待修）

## 架构体检 + 告警 alerter 上线（2026-08-06 21:30）

## 架构体检 + 告警 alerter 上线（2026-08-06）

1. ✅ **Git 瘦身**：langfuse-token .git 1.8G→12M（误提交 tar.gz 孤儿 blob）、Oxelia51 2.0G→18M（删 fe-chunks 分支 + worktree）
2. ✅ **服务器清理**：阿里云旧二进制 server（28M）/0字节垃圾文件/孤儿 frontend/孤儿 langfuse-token 检出/nginx .bak（移入 /root/nginx-bak）全部清除；腾讯云 3 个 dangling 镜像 -4.6G + 重复脚本 install.sh + journal vacuum
3. ✅ **死代码清理**：Oxelia51（mailer.go + SMTP 配置面 + 4 死配置字段 + RandomToken + TouchLastUsed + 3 孤儿部署文件，go build/vet 通过）、langfuse-token（3 无引用 tRPC + 6 孤儿资源 + 46 i18n 批次，typecheck 通过）
4. ✅ **告警引擎部署（补全闭环）**：token-analytics（C++ alerter）编译于本地容器 → 部署腾讯云 `/opt/oxelia51/analytics/token-analytics`，systemd `token-analytics.service`（oneshot，每 5 分钟 timer）已启用
   - CH（127.0.0.1:8123）✅ PG（127.0.0.1:5434）✅ 连接正常
   - 端到端邮件验证：临时预算触发 → alert_logs 落库（status=sent）→ receive@oxelia51.com 收到测试告警邮件
   - 构建方式：`analytics/Dockerfile`（本地容器编译，符合"禁止服务器 make/cmake"）

## 服务健康

| 服务 | 状态 | 备注 |
|------|------|------|
| Langfuse web（腾讯云） | ✅ OK | 中文镜像，4.0.0-rc.2 |
| Langfuse worker（腾讯云） | ✅ OK | |
| ClickHouse（腾讯云） | ✅ OK | |
| Postgres / Redis / MinIO（腾讯云） | ✅ OK | |
| Go 管理后台（阿里云） | ✅ OK | |
| Go 代理网关（阿里云） | ✅ OK | |
| 公网 oxelia51.com | ✅ 200 | |

## 服务器资源

| 指标 | 腾讯云         | 阿里云 |
|------|----------------|--------|
| 磁盘 | 48%（20G 可用） | —      |
| 内存 | 1.4G 可用      | —      |

## ⚡ 事故记录（2026-08-05 19:21 — 20:10）

**症状**：oxelia51.com 全部 502，静态资源（图标/chunk）连接失败 → 加载界面图标缺失。

**根因**：上一轮给 langfuse-web 容器加的 `memory: 1.5G` 限制过小。Node 检测到 cgroup 1.5G 后把 V8 堆上限自动设为 ≈768MB，而 web 启动（init scripts + MCP feature 注册）需要 >760MB 堆 → **每次启动 ~20s 后 `JavaScript heap out of memory` FATAL** → 容器 129 次循环重启（exit 0 但启动即崩）。

**修复**（已持久化到 compose + 已应用）：
- web 内存限制 1.5G → **2.5G**（Node 堆上限翻倍，启动富余）
- web 加环境变量 `NODE_OPTIONS: --max-old-space-size=1536`（显式堆上限，防止自动计算过低）
- 顺带下调：clickhouse 1.5G → 1G（实际占用 503M）、worker 1G → 512M（实际 253M）
- 当前实际占用：web 451M / ch 503M / worker 253M / pg 19M / redis 5M / minio 55M ≈ 1.3G，物理 3.7G 富余

**经验教训**：
1. 给 Node 容器加内存限制必须留足启动峰值（Next.js standalone 启动需 >1GB 堆），且应配 NODE_OPTIONS 显式堆上限
2. 加载界面图标缺失 = 静态资源不可达，先查 web 容器存活，别只查资源文件
3. 腾讯云 SSH 22 仅对阿里云 IP 放行，本机运维须经阿里云跳板（exec API 或 `ssh aliyun` 后 `ssh -i /root/.ssh/tencent_cloud root@118.25.138.177`）

## 第 4 轮变更（2026-08-05，已完成并部署）

1. ✅ 登录按钮需点两下：signIn 成功后显式 `router.push`（原依赖会话刷新→守卫跳转的异步时序）+ 提交中禁用按钮防重复点击
2. ✅ 页脚去除「源码仓库」链接（保留备案 + 由 Langfuse 提供支持）
3. ✅ 加载界面：Spinner 图标加内联 SVG 兜底（PNG 404 也不缺失）、加载文案细分（正在加载账户…）、删除 next.config i18n 配置（消除 /en locale 路由与浏览器语言重定向）
4. ✅ 路由整理：重复「设置」按上下文显隐（项目/组织）、「Go to...」→「前往...」
5. ✅ 删除前端 AI/LLM 用语（47 文件）：LLM 应用→应用、LLM 输出→模型输出、LLM 延迟→模型延迟、LLM-as-judge→自动评估、AI助手→智能助手（保留 Vertex AI/Vercel AI SDK 专有名词）

## 部署验证（2026-08-05 21:20，新镜像 89f7a54f）

- ✅ CI 构建成功（9616e9e），腾讯云 pull + `docker compose -p langfuse up -d langfuse-web`
- ✅ web restarts=0 稳定；公网 200/135ms
- ✅ **/en 已 404**（i18n 删除生效，消除 locale 路由混乱）
- ✅ SSR 实际渲染新文案「正在加载账户」；运行时 .js chunk 含「自动评估」（AI 清理生效）
- ✅ 构建产物无旧词残留（源码仓库 / LLM作为评判 / 添加LLM连接 / Ask AI 全部 CLEAN）
- ⏳ 浏览器级体验回归（登录一次点击、加载图标、侧栏设置项）待用户浏览器确认

## 第 5 轮变更（2026-08-05，已完成并部署）

1. ✅ 后台管理运维凭证：compose 补 `OXELIA51_ADMIN_ACCOUNT/PASSWORD` 传递（原 .env 有值但未注入容器）
2. ✅ 登录/全局按钮 `cursor-pointer`（消除可点击却显示禁止符号的观感）
3. ✅ 全量英文残留清理（242 文件）：功能预览/退出登录/批量操作/通知/导出/成员/评分设置/模型定义/MCP&CLI/首页表格/**时间预设（过去 1 天等 14 个）**/账户设置/项目名称
4. ✅ 页脚字体调大（9/10px→11/12px）
5. ✅ 侧栏版本号保留 + tooltip 说明（版本信息·更新检测·后台迁移），OSS→开源
6. ✅ 侧栏折叠修复：收起后展开按钮常显（图标随状态切换）、logo 折叠态零偏移不挤压
7. ✅ 新增颜色设置（侧栏底部 🎨）：背景色预设（纯白/雾蓝/米黄/墨黑/深蓝）+ 字体色预设（暖棕/墨灰/墨绿/深蓝），localStorage 持久化

## 部署验证（2026-08-05 22:10，新镜像 0cf069b0）

- ✅ CI 构建（140eae3）成功，腾讯云 pull + up -d，web running、local3000 200
- ✅ 公网 200/122ms、/en 404
- ✅ 构建产物验证：颜色设置/背景颜色/字体颜色/退出登录（.js 运行时）/功能预览/全部时间/过去 1 天（.js）全部命中
- ✅ 运维凭证已注入 web 容器 env（OXELIA51_ADMIN_ACCOUNT / PASSWORD 均已有值）
- ⏳ 浏览器级体验回归（登录一次点击、侧栏折叠展开、颜色设置、中文化观感）待用户浏览器确认

## 第 6 轮变更（2026-08-05，已完成并部署）

1. ✅ 账户设置「显示名称」→「修改名称」（标题/提示/Toast 统一）
2. ✅ 成本分析币种统一：CostTrendChart 坐标轴/tooltip 带货币符号；ModelUsageChart/ModelCostTable 接入全局 CNY/USD 切换（首页模型成本图/表不再固定 USD）
3. ✅ 页脚：`由 Langfuse 提供支持` → `Powered by Langfuse`；新增 GitHub 链接（XiaoleC05/Oxelia51）；全站 full 版统一
4. ✅ 登录页：底部加平台亮点卡片（数据追踪/成本分析/提示词管理——**不暴露后台管理**，仅管理员可见的功能对普通用户隔离）

## 部署验证（2026-08-05 23:10，新镜像 8ff9859d）

- ✅ CI 构建（b9347e5）成功，部署后 web running、local3000 200
- ✅ 构建产物验证：修改名称 / 平台亮点 / 数据追踪（.js 运行时）/ GitHub 链接（XiaoleC05/Oxelia51）全部命中
- ⚠️ 注意：CI 有多个 workflow（Codespell/CodeQL/Docker build），轮询 build run 需按 workflow 名称筛选，勿误判其他 run 完成

## 第 7 轮修复（2026-08-05）：进站需刷新才能点击

**症状**：每次进网站必须刷新一次才能正常点击（页面可看但交互无效）。

**排查**：容器稳定、chunk 全部 200、Fresh 浏览器 Playwright 诊断登录/导航正常。

**三个修复**：
1. **代码（636bdfd，已部署 e69cc）**：
   - 移除 `_app.tsx` 的 Google Translate DOM monkey-patch（React 19 下可能中断 hydration）
   - 监听 `pageshow.persisted`：BFCache（浏览器往返缓存）恢复时强制刷新，恢复 React 事件绑定
2. **nginx（已生效）**：`location /api/` catch-all 把 Langfuse 的 `/api/project/*/visit`、`/api/public/*` 转发到 Go 8080 → 404。已在其前新增 `location /api/project/`、`location /api/public/` → Langfuse 3000。验证：visit 401（原 404）、public/health 200。
   - nginx 配置备份：`/etc/nginx/sites-available/oxelia51.com.bak3`
3. **Playwright 诊断结论**：Fresh 浏览器下登录一次成功、侧栏导航（会话等）正常、chunk 全 200、无 console/JS 错误。「追踪」链接 = 首页（/project/[id] 即追踪列表）同路由不跳转属正常。未复现「必须刷新」，故前端修复针对浏览器缓存/往返恢复场景。

## 第 8 轮（2026-08-05）：性能/健壮性/安全/高并发体检

### 安全（P0）
- ✅ 端口暴露核查：腾讯云/阿里云数据库端口全部仅绑定 127.0.0.1，无公网暴露
- ✅ X-Frame-Options 重复头修复（上游 SAMEORIGIN + nginx DENY → 统一 DENY，6 处 proxy_hide_header）
- ✅ 登录限流：nginx limit_req（10r/s + burst 20，纵深防御，Go 侧已有应用层限流）
- ✅ 安全头确认：CSP / HSTS / X-Content-Type-Options / Referrer-Policy 已完备

### 性能（P1）
- ✅ Nginx gzip 全类型启用（原只压缩 html）：JS/CSS/JSON 压缩率 ~65%（112KB→39KB）
- ✅ 静态资源 immutable 长缓存确认（max-age=31536000）
- ✅ worker_connections 768→4096 + worker_rlimit_nofile 65535

### 健壮性（P2）
- ✅ 容器日志轮转：compose 全 6 服务 json-file 50m×3（已应用）
- ✅ ClickHouse 日志轮转（100M×5）+ 截断 928MB→372K（配置在 oxelia51-tuning.xml）
- ✅ 数据库备份 cron：每周日 3:07 pg_dump（docker cp 模式），保留 28 天，实测备份通过
- ✅ docker 镜像清理：回收 14.02GB（磁盘 75%→40%）

### 高并发（P3）
- ✅ worker_connections 4096、Postgres 当前 16 连接健康、登录限流

### 漏洞检测（25 个传递依赖漏洞：3 low/11 moderate/11 high）
- ⚠️ 全部为传递依赖（构建期 webpack/postcss/brace-expansion；深层 sharp/undici/path-to-regexp/uuid）
- ⚠️ pnpm.overrides 升级尝试破坏 postinstall（兼容性），已回退
- ✅ 自托管单用户环境实际利用面极小，接受风险并记录

## 第 9 轮（2026-08-06）：网关状态页 + 邮件告警

1. ✅ 代理网关状态页：新增 internal/stats 统计器（5 分钟滑动窗口），/api/proxy/status 扩展 stats；后端 /api/admin/gateway-stats 服务端代理；后台管理新增「代理网关状态」卡片（QPS/延迟/成功率/供应商分布）——全部部署验证通过
2. ✅ SMTP 邮件告警激活（QQ 邮箱）：
   - 修复 alerter SMTP URL 解析（邮箱含 @ 需最后一个 @ 分割 + %40 解码）
   - 修复 libcurl 分步 PLAIN 认证被 QQ 拒绝（加 CURLOPT_SASL_IR 一次性认证）
   - .env 配置 SMTP_CONNECTION_URL + EMAIL_FROM_ADDRESS；email 通道已建
   - 端到端测试：测试告警成功发信（Alert dispatch complete: 1 sent）
3. ✅ 单云整合评估报告（docs/ops/SINGLE_CLOUD_MIGRATION.md）：短期方案 C 消除 SSH 隧道，中期方案 A 全迁阿里云
4. ✅ CI 增补：deploy.yml 编译 C++ 分析引擎入 release（含 libcurl-dev）

## 第 10 轮（2026-08-06）：并行工作冲突解决 + 反馈/验证闭环 + 502 事故

### 冲突检查（与 kimicode 并行工作）
- ✅ Oxelia51 alerter：无冲突（HTML→结构化→multipart 线性演进，h/cpp 一致）
- ✅ langfuse-token 反馈/落地页：无重复，接线一致
- ⚠️ 告警通道 verified 两套方案冲突：采纳 B（kimicode 验证码流程，未提交已提交）——email 通道 verified=false + 6 位验证码 + 10 分钟 TTL + verify/resend mutation + AlertsSettings 验证 UI
- ⚠️ Oxelia51 CI 曾编译失败（8d3d3f4 alerter.cpp 大改未同步 .h），37 秒后 2f592a6 修复

### ⚡ 502 事故（17:41 崩溃循环 → 用户协助恢复）
- **根因**：015_feedback migration 误放 Go 后端迁移目录（阿里云 DB 无 oxelia51 schema）→ 后端启动跑迁移失败 → 崩溃循环 7355 次 → 全部 /api 502（含登录/exec）
- **恢复**：用户远程删除 015 文件 + 重启后端（exec/SSH/runner 全死锁时唯一通道）
- **教训**：oxelia51 schema 的表迁移放 langfuse prisma（腾讯云）或 analytics migrations，**勿放 Go 后端 migrations（阿里云 DB）**
- **改进**：新增 emergency-restart.yml（阿里云 self-hosted runner 恢复通道）

### P4 完成
- ✅ 告警邮件 multipart HTML（文本兜底 + 品牌 HTML 字段表，已发测试）
- ✅ 反馈渠道：表单落库 oxelia51.feedback + 通知/自动回复邮件 + 后台反馈列表
- ✅ 验证码 migration 已应用（alert_channels 加 verification_code/verification_expires）
- ✅ 部署：web e035f + analytics（multipart alerter）

## 第 11 轮（2026-08-06）：健康检查 + 备份 cron 修复

- ✅ 全系统健康检查：双云服务 active、磁盘 49-51%、腾讯云负载正常（ClickHouse 后台合并）、runner 恢复通道可用、公网/API 200
- ✅ 清理：token-savior 缓存文件移除跟踪；docker-build 目录 gitignore 排除（磁盘占用待进程释放）
- ✅ **备份 cron 修复**：原行内 `$(date +%Y%m%d)` 命令在 cron 环境未生效（无备份文件）；改为 `/usr/local/bin/langfuse-backup.sh` 脚本（日志到 /var/log/langfuse-backup.log），立即触发验证生成 langfuse-db-20260806.dump ✓

## 第 12 轮（2026-08-06）：产品化——网关密钥鉴权 + 接入闭环 + 定价扩充

- ✅ **网关项目密钥鉴权**：proxy_keys 表（阿里云 PG）+ KeyStore + keyAuth（Bearer/x-api-key → 覆盖 X-Project-ID 防伪造）+ 上游真实 key 经 X-Oxelia51-Upstream-Key 传递；PROXY_AUTH_MODE=optional 兼容旧客户端。验证：有效 key 放行、无效 key 401 INVALID_API_KEY
- ✅ **Go 后端 proxy-keys API**：生成（明文仅一次，DB 存 sha256）/列表/软删
- ✅ **web 接入闭环**：设置页「代理接入」（URL+项目ID+密钥管理+分工具配置）+ Token/Cost 空态引导 + LandingPage 用 env
- ✅ **model_pricing 扩充**：3 → 20 个主流模型定价
- ✅ **nginx**：主 conf 加 /api/proxy/ → 9090（鉴权透传）；修复部署脚本覆盖问题
- 部署：网关+后端（587abae）+ web（e3259），公网 200

## 待办

- [x] 开放注册 + 邮箱验证已开启（AUTH_EMAIL_VERIFICATION_REQUIRED=true 已生效）
- [x] 开放注册（邮箱验证）已配置完成——待用户注册实测
- [ ] 后续：docs 站（用户向教程）、收费/配额




