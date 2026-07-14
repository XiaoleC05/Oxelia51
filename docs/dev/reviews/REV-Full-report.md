# Oxelia51 + DormGuard 全方位审查报告

**审查日期**：2026-07-05
**审查员**：Codex + DeepSeek V4 Pro
**基线**：契约 v1.1 + HEAD (fde17c8)

## 执行摘要

整体代码质量中等偏上（6.5/10）。后端架构设计合理，网关实现健壮，安全基础较好。主要风险集中在：(1) DormGuard 配置管理无并发写锁 (P1)；(2) 零前端/集成测试 (P1)；(3) 部署脚本无互斥锁 (P1)。无 P0 级阻断问题，但多个 P1 应在生产上线前处理。平台已具备进入联调阶段的条件。

## 维度1：代码安全漏洞

S1 | P2 | oxelia51/frontend/src/api/index.js:26 | Token 存 localStorage，XSS 可窃取 JWT | 迁移至 httpOnly SameSite=Strict cookie 或 short-lived token + refresh 机制（当前 refresh 已存 localStorage）。P2 因项目以开发者/管理员为主、攻击面较小

S2 | P1 | oxelia51/backend/internal/config/config.go:30 | JWT_SECRET 默认值 "change-me-in-production" 若未配置 .env 则生产用弱密钥 | 添加启动时验证：if cfg.JWTSecret == "change-me-in-production" { log.Fatal("...") }

S3 | P2 | oxelia51/frontend/src/api/index.js:5-9 | X-Oxelia51-Access-Token 作为备用鉴权头与 Authorization 同时发送，若网关未完全剥离则泄漏到上游 | 确认 gateway copyHeaders 已剥离 Authorization，但 X-Oxelia51-Access-Token 未被剥离（有意用作备用鉴权）。上游若透传此头则泄漏

S4 | P1 | DormGuard/backend/app/env_manager.py | write_env_values 无文件锁，并发写 .env 可能导致数据损坏 | 添加 filelock（如 fcntl.flock 或 portalocker）

S5 | P2 | DormGuard/backend/app/admin.py:34-44 | subprocess.run(["systemctl", "restart"], timeout=30) 期间阻塞 API 响应 | 改为 subprocess.Popen 后台重启，立即返回 restart_required

S6 | P2 | oxelia51/backend/internal/middleware/auth.go:14-18 | extractAccessToken 同时接受 Authorization 和 X-Oxelia51-Access-Token。后者若被客户端设置任意值，而网关又未剥离，可伪造身份 | 此路径仅在 gateway proxy 场景有用且 gateway 已剥离外部头。但建议仅接受 Authorization 一个来源，或确认 X-Oxelia51-Access-Token 仅在受信网关内部使用

S7 | P1 | DormGuard/backend/app/auth.py | 自研 HMAC JWT 无标准库支持，alg="none" 攻击未防护 | 使用标准 jwt 库或添加 alg 白名单校验

## 维度2：逻辑冲突与一致性

L1 | P3 | DormGuardTool.jsx vs admin.py | CONFIG_GROUPS (frontend) 与 MANAGEABLE_ENV_KEYS (backend) 一致，10 个 key 完全匹配 | 无问题

L2 | P2 | api/index.js BADGE_LABEL vs platform-api §4.1 | open=已开放, closed_to_users=暂未开放, offline=已下线，完全匹配 | 无问题

L3 | P1 | JWT claims 缺 email_verified | token.go IssueAccess 不包含 email_verified，gateway 无法在无 DB 查询下判断 | 已在 REV-02/03 中标注

L4 | P2 | Settings.vue (DormGuard 原生) vs DormGuardTool.jsx (平台) 双配置面板 | 两份独立配置 UI，字段 key 一致但 UI 框架不同。平台侧 DormGuardTool.jsx CRAWLER_JSESSIONID 标注 sensitive，Settings.vue 无此标注 | 未来 DormGuard 原生前端退役后仅保留平台侧即可

L5 | P1 | canUseTool(tool, user) 在 Tools.jsx 和 ToolShell.jsx 中定义不同 | ToolShell.jsx 导入并使用 canUseTool；Tools.jsx 直接判断 badge+role | 统一使用 canUseTool（已导入但未在 Tools.jsx 调用）

## 维度3：功能 Bug

B1 | P2 | DormGuardTool.jsx:191 | history table 使用 array index 作为 React key: records.map((r,i) =} tr key={i}) | 改为 key={r.record_time || r.id}，防止重排序后渲染错乱

B2 | P1 | VerifyEmail.jsx | fetch 网络错误被当作"链接无效或已过期" | 区分网络错误（fetch 异常）与 API 错误（响应 400），分别给出不同提示

B3 | P2 | ForgotPassword.jsx | API 200 响应显示"重置链接已发送（开发模式请查看后端日志）"-> 生产环境下不应提示"后端日志" | 改为环境变量控制提示文案；生产统一显示"若邮箱已注册，重置链接已发送"

B4 | P1 | DormGuard admin.py:49 | QQ_BOT_ENABLED 字符串 'true'/'false' 保存到 .env 后，前端检查 if the value starts with 'true'，解析正确 | 但 DormGuard config.py 中 QQ_BOT_ENABLED 是 bool 类型，从 .env 读取时字符串 'true'/'false' 需经 pydantic 解析。pydantic 默认不会将 'true' 字符串自动转为 True | 已验证 config.py 的 model_config extra="ignore" + 字段类型为 bool。需确认 pydantic_settings 是否自动转换 'true' 字符串为 bool True。若用 os.getenv 读取则返回字符串 | 需测试

B5 | P2 | apply-release.sh:37-44 | PostgreSQL 就绪等待超时（30 轮 * 2s = 60s）后脚本继续执行，systemctl restart 时会因 PG 未就绪而失败 | 超时后应 exit 1 提示，而非继续执行

## 维度4：用户体验

U1 | P2 | Landing.jsx | 未登录用户着陆页无登录/注册入口，仅有"浏览工具"和"作品集"链接 | 添加登录/注册 CTA，或 navbar 统一提供

U2 | P3 | Register.jsx:39 | 注册成功后 2 秒延迟跳转 | 可省略延迟或提供明确倒计时

U3 | P2 | ResetPassword.jsx | 密码输入框无 minLength={8} 约束，用户可能设弱密码 | 添加 minLength={8} + maxLength={128}（与 Register 一致）

U4 | P3 | DormGuardTool.jsx:241-243 | threshold 输入框 min=1，但无 max 限制 | 添加 max 建议值（如 50）

U5 | P2 | 所有 auth 页面 | 加载/提交中无按钮 disabled + spinner 反馈（Login.jsx、Register.jsx 等）| 提交按钮添加 disabled + loading 文本防止重复提交

U6 | P3 | DormGuardTool.jsx | ConfigPanel 切换 tab 后重新挂载（{viewMode === 'config' && }），导致未保存的表单数据丢失 | 改为 display:none/visibility 切换或保存表单状态

## 维度5：界面逻辑 Bug

UI1 | P1 | ToolShell.jsx:55-57 | 路由守卫：未登录用户被立即重定向到 /login，URL 闪现工具页 | 在 useEffect 中执行 navigate，JSX 渲染阶段工具页内容会短暂闪现。建议使用 组件或 loading 状态下不渲染内容

UI2 | P1 | Tools.jsx:46 | 未登录用户点击"进入"按钮跳转 /login 时保留 return URL（state.from）| 逻辑正确，已验证：`navigate('/login', { state: { from: `/tools/${t.slug}` } })`

UI3 | P2 | DormGuardTool.jsx:147-149 | history 表最近的 12 条从 `[...records].reverse().slice(0, 12)` 获取，reverse() 会改变原数组 | 已使用 [...records] 创建副本，无副作用。但 slice(0,12) 取的是反向后前 12 条=时间最新 12 条。若 records 已是倒序，reverse 会变成正序，再 slice 取的是最旧 12 条 | 建议服务端排序明确

## 维度6：部署与运维

D1 | P1 | webhook/deploy.sh + webhook/receiver.py | 无部署互斥锁。同时触发两次 webhook =} 两个 deploy.sh 并发执行，争夺 REPO_DIR + WORK 目录 | 添加基于 REPO_DIR/.deploy-lock 的 flock 互斥

D2 | P2 | webhook/receiver.py:64 | subprocess.Popen 后台执行 deploy，无任何状态检查 | 添加异步返回机制或 webhook 响应含部署状态 URL

D3 | P2 | apply-release.sh:34 | DB_PASSWORD 通过 grep 从 .env 提取（含特殊字符时可能截断）| 确保 grep/cut 处理 = 号后的完整值，建议 source .env 后直接引用变量

D4 | P2 | deploy.yml:73-76 | release job 用 --orphan release-tmp + --force push 覆盖 release 分支。若 CI token 权限过高可能覆盖其他分支 | release-tmp =} release 的 force push 只影响 release 分支，风险可控。但建议锁定 deploy key 权限为仅 release 分支

D5 | P2 | webhook receiver + nginx | /webhook location 无 nginx 配置，webhook receiver 监听 127.0.0.1:9000 不经过 nginx | webhook 需从 GitHub 公网可达。当前配置仅监听 127.0.0.1，GitHub 无法回调 | 需 nginx 反向代理 /webhook 到 127.0.0.1:9000 并配置 client_max_body_size

D6 | P2 | apply-release.sh:22 | exit 2（.env 不存在）后 nginx/systemd 不重启，但 frontend-dist 和 binary 已覆盖 | exit 2 前应回退或保留旧版本

D7 | P3 | webhook | /var/log/oxelia51-webhook-deploy.log 无 logrotate | 添加 logrotate 配置

D8 | P1 | Oxelia51 prod nginx | 当前 nginx 配置 proxy_set_header Authorization 透传客户端原始头到 Go 8080。Go 端 authMW.Handle() 解析此头进行 JWT 鉴权 | 此配置在生产正确。但若 Go 后端信任 IP 头（c.ClientIP()），则需确保 trust proxies 配置 |

## 维度7：测试覆盖

T1 | P1 | 全局无前端测试 | frontend/ 零测试文件 | 添加关键路径测试（auth flow、tool list badge、ToolShell guard）

T2 | P2 | Oxelia51 backend 无 auth handler 测试 | handler/auth_test.go 不存在 | 添加 Register/Login/Refresh/Logout handler 层次测试

T3 | P2 | DormGuard 零测试 | backend/app/ 零测试文件 | 添加 auth、admin settings、env_manager 模块测试

T4 | P2 | 无集成测试 | 无 end-to-end 测试覆盖 gateway -} DormGuard 路径 | 添加集成测试：启动平台 Go + DormGuard FastAPI 模拟实例，验证 proxy 转发

T5 | P1 | 无并发/竞态测试 | proxy.go 中 pool 安全但 handler 包无 races test | 运行 go test -race 并确保覆盖 gateway 和 handler

## 优先级排序

1. P1 D5 - webhook receiver 公网不可达（nginx 缺反向代理 /webhook）
2. P1 D1 - 部署无互斥锁
3. P1 S2 - JWT_SECRET 默认弱密钥
4. P1 S7 - DormGuard auth 自研 JWT 防 alg=none
5. P1 L3 - JWT 缺 email_verified（已知 REV-02/03 残余）
6. P1 UI1 - ToolShell 未登录闪现
7. P1 T1/T5 - 零前端测试 / 无 -race CI
8. P1 S4 - .env 无并发写锁
9. P2 各项（B1-B5, U1-U6, D2-D4, D6-D7, T2-T4）

## 总体评价

**评分**：6.5/10

**理由**：后端架构设计扎实，网关实现比预期更健壮（SSRF 防护、头剥离、体限制、超时控制均到位）。认证链路（注册-}验证-}登录-}限流-}登出）完整且安全。DormGuard 与平台集成路径清晰。

主要扣分点：前端零测试、后端 handler 层零测试、部署链缺少互斥锁和 webhook 公网入口、JWT 默认密钥可被绕过。这些问题均为 P1 级操作问题，非架构缺陷，可在 1-2 个迭代内解决。

**上生产结论**：不建议当前上生产。修复 D5（webhook 公网可达）和 D1（部署锁）后再考虑。开发者内测（本地/SSH）可继续。
