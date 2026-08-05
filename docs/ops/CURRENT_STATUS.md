# 当前服务状态

> 最后更新：2026-08-05 20:30

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

## 待办

- [ ] 浏览器级体验回归确认（用户侧）
- [ ] ClickHouse native TLS（跨云写入加密）
