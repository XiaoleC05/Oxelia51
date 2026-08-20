# Oxelia51 运维手册（RUNBOOK）

> 实战验证的运维操作技巧与踩坑记录（2026-08-09 全量部署沉淀）。
> 服务器访问密码**绝不写入本文件**——见本地记忆 `server-access-topology`（账号 `oxelia51`，密码变量 `$ADMIN_PASSWORD`）。

## 1. 访问通道

- **本机 SSH 直连被安全组拦截**（阿里云 47.108.202.199:22、腾讯云 118.25.138.177:22），不要重试。
- **阿里云操作**：走 exec API（HTTPS 443）：
  ```bash
  # 登录拿 JWT（body 是 account 不是 username）
  curl -s -X POST https://oxelia51.com/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"account":"oxelia51","password":"$ADMIN_PASSWORD"}'
  # 执行命令
  curl -s -X POST https://oxelia51.com/api/admin/exec \
    -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"command":"hostname"}'
  ```
  命令 ≤4096 字符，**timeout ≤30s**。
- **腾讯云操作**：阿里云 exec 里再 ssh 隧道：
  ```bash
  ssh -i /root/.ssh/tencent_cloud -o StrictHostKeyChecking=no root@118.25.138.177 '<cmd>'
  ```

## 2. exec API 操作要点（关键坑）

### 2.1 后台任务必须 setsid 脱离，否则 exec 进程 SIGKILL

后台跑长任务（下载、构建、compose pull）时，**不能**直接 `nohup ... &`，会因后台进程继承 fd 致 Go 端 `cmd.Wait()` 卡住被 kill。必须：

```bash
# 正确：setsid 完全脱离进程组 + 关 stdin + 重定向 + done 标记
setsid bash -c '<cmd> > /tmp/x.log 2>&1 && echo DONE > /tmp/x.done' < /dev/null > /dev/null 2>&1 &
# 然后轮询 /tmp/x.done
```

### 2.2 多层 bash 引号陷阱

命令经 `json.dumps → curl -d → Go bash -c → ssh → 远端 bash` 多层传递。**规则**：
- ssh 远端命令用**单引号**包裹，内部避免 `|` `&&` `{{}}` `>` 等特殊字符（会被两层 bash 解析）。
- 需要 `{{.Names}}` 之类时改用无 format 命令（如 `docker ps -a`）本地过滤。
- Windows Python `subprocess.run` 必须加 `encoding="utf-8", errors="replace"`，否则 GBK 解码 UTF-8 崩溃。
- 引号嵌套脆弱时，用 Python heredoc 构造命令字符串（避免 bash 单引号拼接）。

### 2.3 跨云传文件

```bash
cat /local/file | ssh -i /root/.ssh/tencent_cloud root@118.25.138.177 'cat > /tmp/remote-file'
# 两端 ls -la 比对字节数确认
```

### 2.4 大文件下载

GitHub release tarball 在服务器上下载（~17MB）秒级；ACR 镜像（~1.8GB）需 setsid 后台 + 轮询。

## 3. 五条部署管线

### 3.1 web（本仓 web/，腾讯云）
1. `git push` main → CI build-docker → 推 ACR `.../oxelia51/langfuse-token:latest`
2. 腾讯云（经 ssh 隧道）：`cd /opt/langfuse && docker compose -f docker-compose.langfuse.yml pull langfuse-web && docker compose -f docker-compose.langfuse.yml up -d langfuse-web`
3. **验证**：`curl -sI https://oxelia51.com/favicon.ico` 大小应匹配仓库新文件。

### 3.2 backend（Go，阿里云）
1. `git push` master → deploy.yml 构建 release tarball → GitHub Release `release-YYYYMMDDHHMMSS`
2. 阿里云：下载 tarball → 解压 → `bash ./deploy/apply-release.sh <dir>`（install + restart）
   - 注：apply-release.sh 可能卡在「等待 PostgreSQL 就绪」且不写完成标记，但 install+restart 已发生，验证服务 active 即可。
3. **验证**：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/debug/pprof/` 应为 404（pprof 默认关闭）。

### 3.3 proxy 网关（Go，阿里云）
```bash
install -m 755 /tmp/rel/proxy/proxy-server /opt/oxelia51/proxy/proxy-server
systemctl restart token-proxy
curl -s http://127.0.0.1:9090/api/proxy/status   # 验证返回完整 providers
```

### 3.4 analytics（C++ alerter，腾讯云）
- 二进制从 release tarball `analytics/token-analytics` 经 ssh 管道传腾讯云 → install → `systemctl restart token-analytics`
- **GitHub 资产限速绕行**（三地都可能卡 S3）：本地 Docker 构建（`analytics/Dockerfile`）→ `docker create` + `docker cp` 提取二进制 → `gzip -c | base64 -w0` → 按 ≤3600 字符 `fold -w 3600` 分块，每块 `printf %s '<chunk>' >> /tmp/x.b64.gz` 走 exec 上传 → 解码后比对字节数 → cat | ssh 传腾讯云 install
- **CH 系统日志表膨胀**：trace_log/text_log/part_log 无 TTL 会吃掉十几 GB。清理顺序：**先 TRUNCATE 再 MODIFY TTL**（大表直接 ALTER 会 MEMORY_LIMIT_EXCEEDED，且产生未完成 mutation 需 KILL MUTATION）
- **验证**：`journalctl -u token-analytics -n 8` 应显示分块聚合（chunk #N）或 No new events + `Deactivated successfully`（oneshot 正常终态是 inactive）。

### 3.5 桌面 release（v* tag）
1. 统一版本号后再打 tag：`desktop/src-tauri/tauri.conf.json`、`desktop/ui/package.json`、`desktop/ui/src/version.ts` 三处一致，否则安装包显示旧版本号。
2. `git tag vX.Y.Z && git push origin vX.Y.Z` → CI desktop-build 三平台 → GitHub Release。
3. **验证**：release 资产名含正确版本号（如 `Oxelia51_0.1.2_x64-setup.exe`）。

## 4. 常见坑速查

| 坑 | 症状 | 规避 |
|---|---|---|
| macOS 编译失败 | `E0599: no method named set_hidden_title` | `cfg(target_os="macos")` 代码 Windows 本地编译不暴露，**必须 CI 验证**；`TitleBarStyle::Overlay` 已隐藏标题，别调不存在的 setter |
| 版本号错位 | 安装包显示 0.1.0 而 tag 是 v0.1.1 | tag 前统一 tauri.conf / package.json / version.ts 三处 |
| exec 后台被 kill | `signal: killed` | 用 `setsid bash -c '...' </dev/null >/dev/null 2>&1 &` + done 标记轮询 |
| 远端命令错乱 | `command not found`、`{{.Names}}: command not found` | ssh 远端命令单引号包裹，避免特殊字符 |
| GitHub 日志 403 | `Must have admin rights` | 匿名无法下载 workflow logs；请有权限者贴日志或提供 PAT |
| Python 崩 | `UnicodeDecodeError: 'gbk'` | subprocess 加 `encoding="utf-8", errors="replace"` |
| exec JSON 转义崩 | `invalid character ... in string escape` / `unexpected EOF` | 多层引号（bash→JSON→ssh→远端）别手拼：Write 工具写 JSON 文件 + `curl -d @file`；SQL 一律 `echo <b64> \| base64 -d \| docker exec -i <容器> clickhouse-client/psql --multiquery` |
| exec 超时误判 | `signal: killed` | 30s 超时杀进程树，但 stdout 常已完整返回——先看输出再判断；真长任务 setsid + done 标记 |
| CH 游标毫秒截断 | 边界事件每次运行重复聚合、daily_stats 重复累加 | analytics 游标必须 `parseDateTime64BestEffort(..., 3)`，勿用 parseDateTimeBestEffort（截断小数秒） |
| CH 系统日志吃满盘 | 腾讯云磁盘 84% | 见 §3.4：TRUNCATE system.trace_log/text_log/part_log + MODIFY TTL（7d） |

## 5. 部署后验证清单

- [ ] web：favicon/icon-glyph 大小匹配仓库新文件；文档内容更新
- [ ] backend：pprof 404、exec API 正常、auth 登录正常
- [ ] proxy：`/api/proxy/status` 返回完整 providers + stats
- [ ] analytics：journal 完整执行无 error
- [ ] 桌面：release 资产版本号正确、三平台齐全

关联：[deploy/README.md](README.md)（架构与流程）、本地记忆 `deployment-pipeline`/`server-access-topology`。
