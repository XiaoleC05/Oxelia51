# Umami 自托管部署（stats.oxelia51.com）

站点访问统计，独立 compose 部署，不影响主栈。全程在服务器上执行。

## 前置

- DNS：`stats.oxelia51.com` A 记录已指向本服务器。
- 主站 nginx 与 certbot 已在用（同 `deploy/nginx/oxelia51.com.conf` 的环境）。

## 步骤

### 1. 配置环境变量

```bash
cd /opt/Oxelia51/deploy/umami
cat > .env <<EOF
UMAMI_DB_PASSWORD=$(openssl rand -hex 16)
UMAMI_APP_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 .env
```

`.env` 仅本机使用，勿提交仓库。

### 2. 启动 Umami

```bash
docker compose -f docker-compose.umami.yml up -d
docker compose -f docker-compose.umami.yml logs -f umami   # 确认迁移完成、监听 3000
```

数据库（独立实例 `umami-db`，库名 `umami`）由 compose 自动创建并完成表结构迁移，无需手工建库。

### 3. 申请证书

```bash
# 方式 a：webroot（推荐，不中断现有 nginx）
mkdir -p /var/www/certbot
# 先只启用 nginx-stats.conf 里的 80 端口 server 块，reload 后：
certbot certonly --webroot -w /var/www/certbot -d stats.oxelia51.com

# 方式 b：certbot --nginx -d stats.oxelia51.com（自动改写配置）
```

### 4. 启用 nginx

```bash
cp nginx-stats.conf /etc/nginx/sites-enabled/stats.oxelia51.com.conf
nginx -t && systemctl reload nginx
```

（如用方式 a，拿到证书后再把 443 server 块一并启用并 reload。）

### 5. 创建 Website，拿 website-id

1. 打开 `https://stats.oxelia51.com`，默认账号 `admin` / `umami` 登录，**立即修改密码**。
2. Settings → Websites → Add website：名称 `Oxelia51`，域名 `oxelia51.com`。
3. 在该 website 的 Tracking code 页面复制两样东西：
   - `data-website-id`（website-id）
   - 脚本地址 `https://stats.oxelia51.com/script.js`

### 6. web 侧配置 env

在 web（Langfuse Next.js）部署环境追加两个变量并重启：

```bash
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<上一步的 website-id>
NEXT_PUBLIC_UMAMI_SRC=https://stats.oxelia51.com/script.js
```

注意：`NEXT_PUBLIC_*` 是构建期内联变量，改完需要**重新构建** web 镜像/产物，仅重启进程不生效。
两个变量都配置后，所有页面 `<head>` 才会注入 umami 脚本（`async`+`defer`，不阻塞渲染）；缺任意一个不注入。

### 7. 查看报表

登录 `https://stats.oxelia51.com`，进入 `Oxelia51` website 即可看访问量、来源、页面明细。

## 运维

- 升级：`docker compose -f docker-compose.umami.yml pull && docker compose -f docker-compose.umami.yml up -d`
- 数据：全部在 `umami-pgdata` volume，备份该 volume 即可。
- 卸载：`docker compose -f docker-compose.umami.yml down -v`（`-v` 会删除统计数据，慎用）。
