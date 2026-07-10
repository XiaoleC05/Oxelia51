# 头图轮播审查报告（REV-Hero）

**审查日期**：2026-07-06
**基线**：19ab3ed（后端 commit）
**审查 Commit**：19ab3ed feat: hero image carousel backend + navbar

> **注意**：Trae 前端实现（HeroCarousel 组件 + Admin 头图 management tab）在当前 master 分支不存在，可能位于独立 feature 分支。本次审查仅覆盖后端实现。前端相关建议为基于 API 契约的推断。

## 后端审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| H1 | P1 | handler/hero.go:Upload | **上传无文件类型校验** — 仅限制大小 10MB，未校验扩展名或 MIME 类型。SVG（可含 XSS）、PHP、HTML 等均可上传 | 添加扩展名校验：**仅允许 jpg/jpeg/png/gif/webp**。可通过 `filepath.Ext` + 白名单 + `http.DetectContentType` 双验证 |
| H2 | P2 | handler/hero.go:NewHeroHandler | **上传目录权限 0755 过宽** — 目录可读可执行（正常），但 0755 也允许所有人读。建议 0750 | 改为 `os.MkdirAll(dir, 0750)`，nginx 通过运行用户组读取 |
| H3 | P2 | handler/hero.go:Upload | **文件名仅依赖时间戳冲突** — 同一纳秒多个并发请求可能文件名重复导致覆盖 | 在时间戳后追加随机字符串（如 `uuid.NewString()[:8]`），或直接使用 UUID |
| H4 | P2 | handler/hero.go:Upload | **未清理已损坏文件** — `c.SaveUploadedFile` 写入后无内容完整性检查。若只写了部分文件（磁盘满等），前端仍可访问损坏图片 | 建议写入后读取前几个字节检查 `DetectContentType`，类型不在白名单内则删除并返回错误 |
| H5 | P3 | handler/hero.go:Upload | **返回 URL 硬编码 /uploads/ 前缀** — 若将来部署域名前缀变化需改代码 | 改为从配置读取 `AppPublicURL` + `/uploads/` 拼接 |
| H6 | P1 | migrations/005_hero_images.up.sql | **image_url 无 UNIQUE 约束** — 同一图片 URL 可重复插入，数据库无法检测重复 | 不需要修复（同一 URL 可多张） |
| H7 | P2 | migrations/005_hero_images.up.sql | **无 display_order UNIQUE 约束** — 多张图相同 order 可接受（ORDER BY display_order, id 作 tiebreaker），但建议加上 `UNIQUE` 避免管理端困惑 | 可不加，当前设计 OK |
| H8 | P2 | migrations/005_hero_images.up.sql | **无 down 迁移脚本** — 与项目既有模式一致（003_auth_v11 也无 down）| 建议补充 |
| H9 | P2 | handler/hero.go:Delete | **删除不清理磁盘文件** — DELETE 仅删除 DB 记录，不上传的图片文件残留在 `/opt/Oxelia51/uploads/hero-images/` 中 | 删除前从 DB 读取 `image_url`，提取文件名，执行 `os.Remove`。清理失败应记日志而非阻止 DB 删除 |
| H10 | P1 | handler/hero.go:NewHeroHandler | **上传目录硬编码为 /opt/Oxelia51/uploads/hero-images** — 若本地开发测试，目录不存在或权限不足时静默创建失败（MkdirAll 错误被忽略） | `_ = os.MkdirAll(dir, 0755)` 的错误被完全忽略。改为：`if err := os.MkdirAll(dir, 0750); err != nil { log.Fatalf(...) }` |
| H11 | P1 | handler/hero.go + config.go | **上传目录路径硬编码** — `/opt/Oxelia51/uploads/` 在本地开发不存在，导致上传失败 | 改为从 config.go 读取 `UploadDir` 配置项（开发环境可指向本地路径），或 Auto-migrate 创建 |

### 后端已正确处理项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| SQL 注入 | ✅ 全部参数化 | 所有 Query/QueryRow/Exec 使用 $1/$2... 占位符 |
| Delete auth | ✅ 中间件保护 | admin.DELETE("/hero-images/:id") 在 admin group 下，有 authMW + RequireAdmin |
| nginx 路径穿越 | ✅ alias 安全 | `/uploads/` alias `/opt/Oxelia51/uploads/` 尾部 / 匹配正确，无穿越 |
| 表索引 | ✅ 合理 | idx_hero_images_order(display_order) 支持 ORDER BY |
| Public API 过滤 disabled | ✅ 正确 | WHERE enabled = TRUE 筛选已启用的轮播项 |
| Update COALESCE | ✅ 正确 | 指针类型参数，nil 表示不更新 |
| 上传大小限制 | ✅ 10MB | file.Size > 10<<20 时返回 FILE_TOO_LARGE |

## 前端审查

> 当前 master 分支未找到 Trae 前端实现的 HeroCarousel 组件 + Admin 头图管理 UI。以下审查基于 API 契约推断。

| 编号 | 严重度 | 位置（预期） | 问题 | 建议修复 |
|------|--------|-------------|------|----------|
| F1 | P2 | Landing.jsx or HeroCarousel.jsx | 轮播组件应使用 `React` 渲染 （JSX 自动转义 title/subtitle）而非 `dangerouslySetInnerHTML` | 确认使用 JSX 表达式 |
| F2 | P2 | Landing.jsx or HeroCarousel.jsx | 自动轮播应使用 `setInterval` + `useEffect` cleanup 防止内存泄漏 | useEffect 返回 clearInterval |
| F3 | P2 | Landing.jsx | 网络错误/API 失败时应有降级显示（无头图时显示纯色背景或默认 hero.png） | 检查 `hero.png` 是否作为 fallback |
| F4 | P3 | Landing.jsx | 多图加载建议 lazy loading（loading="lazy"）| 添加 loading="lazy" 属性 |
| F5 | P2 | Admin.jsx (hero tab) | 头图管理 tab 应有 CRUD 界面 | 需实现 |
| F6 | P2 | Admin.jsx (hero tab) | 上传按钮应前端预检文件类型 + 大小（避免上传后后端拒绝），且显示上传进度 | 使用 FileReader 预检类型 + size 检查 + XMLHttpRequest 监听 progress |
| F7 | P2 | Admin.jsx (hero tab) | 上传后应更新图片列表；删除应在确认后执行 | 使用 window.confirm 或自定义弹窗 |

## 部署审查

| 编号 | 严重度 | 位置 | 问题 | 建议修复 |
|------|--------|------|------|----------|
| D1 | P1 | deploy/apply-release.sh | `rsync -a --delete "$RELEASE_DIR/frontend-dist/" "$APP_DIR/frontend/dist/"` 只保护了 frontend/dist，不覆盖 uploads 目录 | `/opt/Oxelia51/uploads/` 独立于 `frontend/dist/`，不受 `--delete` 影响。✅ **无需修复** |
| D2 | P2 | deploy/nginx/default-ip.conf | `/uploads/` nginx location 缓存策略 `Cache-Control "public, max-age=3600"` 合理 | ✅ 1 小时缓存适合头图 |
| D3 | P2 | deploy/apply-release.sh | 上传目录需确保部署后存在 | 建议在 apply-release.sh 中添加 `mkdir -p /opt/Oxelia51/uploads && chmod 750` |
| D4 | P1 | 无上传目录备份 | 头图图片文件在 `/opt/Oxelia51/uploads/hero-images/` 不在 Git 中，也无备份策略 | 建议将 uploads 目录纳入定期备份范围 |

## 总体评价

**评分：6.5/10**

后端实现整体合格——SQL 参数化完整、路由鉴权正确、公开 API 的 enabled 过滤到位、COALESCE 更新模式正确。主要扣分点集中在 **Upload handler**：

1. **无文件类型校验**（P1）— 任何人都可上传任意文件（SVG/HTML/PHP），构成 XSS/文件上传攻击面
2. **上传目录路径硬编码**（P1）— `/opt/Oxelia51/uploads/` 在本地开发不可用，且 `MkdirAll` 的错误被完全忽略
3. **删除不清理磁盘**（P2）— 数据库记录删除后图片文件残留
4. **文件名仅靠纳秒时间戳**（P2）— 并发冲突风险低但存在

建议 **修复合 H1（文件类型白名单）+ H10（上传目录错误处理）+ H11（路径配置化）后合并到 master**。H9（删除清文件）可在下个迭代中完成。

前端实现未在当前 master 分支找到（可能在 Trae 独立 feature 分支中），已列出 API 契约推断的审查项供 Trae 参照。
