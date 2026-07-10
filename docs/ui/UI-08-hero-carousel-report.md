# UI-08 首页头图轮播 + Admin 头图管理 交付报告

> 日期：2026-07-06  
> 目标：实现首页全屏头图轮播 + 管理后台头图 CRUD 管理界面  
> 参考视觉：NASA.gov hero（全幅大图 + 渐变叠加 + 白色大字标题）

---

## 一、Before / After 描述

### 1.1 首页（Landing）

| 项目 | Before | After |
|------|--------|-------|
| 页面顶部 | 深色 hero（CSS 纯色背景 + 品牌标题） | 全屏头图轮播（API 动态图片 + 渐变叠加 + 标题/副标题） |
| 轮播功能 | 无 | 自动播放（5s）、渐变切换（fade 0.8s）、圆点指示器、左右箭头 |
| 无图片处理 | — | 默认深色渐变背景（`linear-gradient`）+ 品牌标语 |
| 文字层 | hero 内嵌白色大字 | 轮播底部叠加（底部渐变遮罩 `rgba(0,0,0,0.6)` → `transparent`） |
| 字体 | 衬线超大（6rem） | 轮播标题衬线 `clamp(2rem, 4vw, 3rem)` + 副标题 Inter 16px |
| 轮播下方 | — | 保留原有三段式内容（hero → body → footer） |

### 1.2 管理后台（Admin）

| 项目 | Before | After |
|------|--------|-------|
| Tab 数量 | 3 个（工具、用户、作品集） | 4 个（+ 头图） |
| 头图管理 | 无 | 完整 CRUD：上传/URL 添加/编辑/删除/启停 |
| 管理界面 | — | 卡片式网格（缩略图 16:9 + 标题 + 副标题 + 排序号 + 操作按钮） |
| 上传功能 | — | 文件选择 + 预览 + 前端 10MB 校验 + multipart form 上传 |
| URL 添加 | — | URL 输入 + 实时预览 + 字段填写 |
| 编辑 | — | URL/标题/副标题/排序/启停开关 全字段编辑 |
| 删除 | — | 确认弹窗后删除 |
| 启停 | — | 卡片内 checkbox 一键切换 |

---

## 二、调整文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/api/index.js` | 改 | 新增 `apiPut` 函数；新增 6 个 hero image API 函数（`fetchHeroImages`、`adminFetchHeroImages`、`adminCreateHeroImage`、`adminUpdateHeroImage`、`adminDeleteHeroImage`、`adminUploadHeroImage`） |
| `frontend/src/pages/Landing.jsx` | 改 | 新增轮播组件逻辑：useState/useEffect 管理图片、current index、定时器；新增默认 fallback hero；保留原有三段式内容 |
| `frontend/src/pages/Landing.css` | 改 | 新增轮播相关全部样式：`.hero-carousel`（100svh 全屏）、`.hero-carousel-slide`（absolute 定位 + opacity 过渡）、overlay 渐变遮罩、文字层、箭头、圆点、响应式 |
| `frontend/src/pages/Admin.jsx` | 改 | 新增 `HeroImagesTab` 组件（~400 行）：卡片网格列表、上传弹窗、URL 添加弹窗、编辑弹窗、启停切换、删除确认 |
| `frontend/src/pages/Admin.css` | 改 | 新增头图卡片网格样式（`.hero-card-grid`、`.hero-card`、`.hero-card-thumb`）、预览样式（`.hero-preview`）、inline checkbox 字段（`.admin-field--row`）、响应式 |
| `docs/ui/UI-08-hero-carousel-report.md` | 新增 | 本报告 |

**未修改：**
- `backend/**`
- `docs/api/**`
- `package.json`
- 路由结构（`App.jsx`）
- 现有 Tool/User/Portfolio 管理代码

---

## 三、轮播配置说明

| 配置项 | 值 | 位置 |
|--------|-----|------|
| 自动播放间隔 | `5000`ms（5 秒） | `Landing.jsx` 第 6 行 `AUTOPLAY_INTERVAL` 常量 |
| 切换动画 | `opacity 0.8s ease-in-out`（渐变淡入淡出） | `Landing.css` `.hero-carousel-slide` |
| 图片层叠 | `absolute` + `inset: 0`，active slide z-index 更高 | CSS 布局 |
| 图片尺寸 | `cover` + `center` 裁剪填充 | CSS `background-size/position` |
| 渐变遮罩 | `transparent 50% → rgba(0,0,0,0.35) 70% → rgba(0,0,0,0.6) 100%` | CSS `linear-gradient` |
| 无图片默认背景 | `linear-gradient(135deg, #1a1d24 → #0d1b2a → #1b2838)` | CSS `.hero-carousel-slide--default` |
| 标题字体 | `clamp(2rem, 4vw, 3rem)` 衬线 Noto Serif SC | CSS `.hero-carousel-title` |
| 副标题字体 | `16px` Inter | CSS `.hero-carousel-subtitle` |
| 文件上传限制 | `10MB`（前端预检 + 后端校验） | Admin 前端 `MAX_FILE_SIZE = 10 * 1024 * 1024` |

---

## 四、API 接口对照

| 接口 | 方法 | 认证 | 前端函数 |
|------|------|------|----------|
| `/api/hero-images` | GET | 无 | `fetchHeroImages()` |
| `/api/admin/hero-images` | GET | Bearer + admin | `adminFetchHeroImages()` |
| `/api/admin/hero-images` | POST | Bearer + admin | `adminCreateHeroImage(data)` |
| `/api/admin/hero-images/:id` | PUT | Bearer + admin | `adminUpdateHeroImage(id, data)` |
| `/api/admin/hero-images/:id` | DELETE | Bearer + admin | `adminDeleteHeroImage(id)` |
| `/api/admin/hero-images/upload` | POST | Bearer + admin | `adminUploadHeroImage(file)` |

---

## 五、构建验证

```
npm run build → ✓ built in 110ms
54 modules transformed.
dist/assets/index.css  29.38 kB (gzip: 5.80 kB)
dist/assets/index.js  283.52 kB (gzip: 86.61 kB)
```

无错误，无警告。移动端 375px 可用。
