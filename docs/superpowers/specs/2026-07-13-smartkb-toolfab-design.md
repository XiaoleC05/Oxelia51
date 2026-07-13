# Oxelia51 导航重构 + SmartKB 智能知识库 — 设计文档

**版本**：v1.0 | **日期**：2026-07-13 | **状态**：已确认

---

## 一、目标

1. **导航重构**：移除导航栏「工具」菜单，改为全局浮动工具球（ToolFAB），以 Oxelia51 logo 为图标，悬浮于所有页面
2. **SmartKB 智能知识库**：项目文档 + 代码全量向量化，支持自然语言搜索 + RAG 对话，以独立悬浮窗形式存在于所有页面
3. **首页 Logo**：透明背景的 logo 置于首页文字上方

---

## 二、交互架构

```
页面根层 (React Portal, z-index 体系)
│
├─ [z-index: 10000] ToolFAB 工具浮球
│   ├─ 默认位置：右下角 right:24px, bottom:80px
│   ├─ 拖动定位 → localStorage("oxelia51_fab_pos")
│   ├─ 单击 → 展开/收起工具列表
│   ├─ 双击 → 直接打开上次工具
│   └─ 首次进入 → 弹跳动画 + 气泡提示
│
├─ [z-index: 9999] SmartKB 浮窗
│   ├─ 默认位置：右下角 right:24px, bottom:400px
│   ├─ 拖动定位 → localStorage("oxelia51_smartkb_pos")
│   ├─ 输入框 → 检索结果(左50%) + AI回答(右50%) 并排
│   └─ 独立控制，与工具浮球无关联
│
└─ [z-index: 9998] BackToTop / ScrollProgress 等其他悬浮元素
```

---

## 三、ToolFAB 工具浮球

### 3.1 外观

- 圆形 60×60px（移动端 48px）
- 图标：扳手拧螺母 SVG 动画
- 背景色：`var(--accent)`

### 3.2 动画规格

| 状态 | 描述 |
|------|------|
| 静止 | 扳手对准螺母，微微呼吸光晕 |
| 悬停 | 扳手顺时针拧动螺母，每拧 60° 脱离、弹回原位置、重新放上螺母，循环。螺母微微发亮 |
| 点击(展开) | 扳手拧紧到底（旋转 180°），停住不动，螺母高亮绿色 |
| 收起 | 扳手反转 180° 松开，回到静止态 |
| 首次提示 | 弹跳动画 ×2，右侧气泡「工具入口在这里 ↗」5s 淡出 |

### 3.3 展开样式

- 智能方向：计算浮球到视口四边距离，选空间最大侧展开
- 默认向下纵向列表排列，每个条目间距 8px
- 展开动画：stagger 延迟 60ms/项，从浮球中心缩放弹出（scale 0→1 + opacity 0→1），ease-out-back
- 收起动画：反向 stagger 依次吸回

### 3.4 交互

| 操作 | 行为 |
|------|------|
| 单击 | 展开 / 收起 |
| 双击 | 直接跳转上次使用的工具 (`oxelia51_last_tool`) |
| 点击空白处 | 收起 |
| Esc | 收起 |
| 拖拽 | 限制在视口内，存 localStorage（百分比 vw/vh） |

### 3.5 移动端

- 浮球 48px
- 展开方式改为底部抽屉式面板
- 禁用拖动

---

## 四、SmartKB 智能知识库

### 4.1 浮球外观

- 圆形 60×60px
- 图标：Oxelia51 星球 SVG + 数字「51」
- 背景色：`var(--accent-2)` 或深蓝渐变

### 4.2 动画规格

| 状态 | 描述 |
|------|------|
| 静止 | 星球 + 「51」静止 |
| 悬停 | 两条星轨环绕星球旋转（不同速度），「51」浮动 ±3px |
| 点击(展开) | 星球放大 110% → 缩回 100%（弹性 ease-out-back），8-12 颗粒子从边缘飞散 30-40px 后消失 |
| 关闭 | 粒子反向吸入，缩小 95% → 弹回 100% |

### 4.3 浮窗布局

```
┌─ SmartKB ───── [⤡] [×] ──────────────┐
│  输入框: [_______________] [发送]      │
│────────────────────────────────────────│
│  检索片段 (左 50%)  │  AI 回答 (右 50%) │
│                     │                  │
│  [1] ADR-002.md:15  │  根据 ADR-002...  │
│  平台通过 API 网关... │  [1][3]          │
│                     │                  │
│  [2] gateway-cont..  │                  │
│  前端不直连工具端口...│                  │
└────────────────────────────────────────┘
```

- 尺寸：默认 680×520px，最小 480×360px，可拖动 resize handle
- 位置持久化：`oxelia51_smartkb_pos`
- 可拖动标题栏移动

### 4.4 后端架构

```
POST /api/smartkb/chat     — RAG 对话，流式 SSE 输出
POST /api/smartkb/search   — 关键词检索
POST /api/smartkb/ingest   — 手动触发全量索引
GET  /api/smartkb/status   — 索引状态（文档数、最后索引时间）
```

### 4.5 数据摄入策略

| 来源 | 路径 | 内容 |
|------|------|------|
| Oxelia51 平台 | `docs/**/*.md` | ADR、API 契约、开发规范 |
| Oxelia51 平台 | `AGENTS.md` `CLAUDE.md` `README.md` `CHANGELOG.md` | 项目文档 |
| 8 个工具仓库 | `D:\07_Projects\code\<tool>\*.md` | 各工具 README |
| 8 个工具仓库 | `D:\07_Projects\code\<tool>\internal\**\*.go` | Go 源码 + 函数签名 + 注释 |
| 8 个工具仓库 | `D:\07_Projects\code\<tool>\cmd\**\*.go` | 入口 / 路由代码 |

- 文档切块：按 `##` 标题切分，相邻块 100 字符重叠上下文
- 代码切块：Go AST 解析，每个函数/方法一个块，携带包名+接收者+签名+注释
- 向量化：调用 LLM Embedding API（text-embedding-3-small 或 DeepSeek embedding）
- 存储：PostgreSQL 17 pgvector 扩展

### 4.6 RAG 对话流程

```
用户提问
  → 1. Embed query → 向量检索 top-K (K=5) 最相关片段
  → 2. 关键词 BM25 检索 top-3 补充片段
  → 3. 合并去重 → 构建 prompt:
      "你是 Oxelia51 项目知识助手。基于以下资料回答问题:"
      "[1] docs/adr/ADR-002.md:\n..."
      "[2] SuperRead/handler/brief.go:\n..."
      "问题: 用户提问"
  → 4. 流式 SSE 输出答案，答案中引用编号 [1][3]
  → 5. 前端并排展示：左侧片段列表，右侧流式答案
```

### 4.7 数据库 Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE smartkb.documents (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'markdown',
    chunk_count INT DEFAULT 0,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE smartkb.chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES smartkb.documents(id),
    content TEXT NOT NULL,
    embedding vector(1536),
    chunk_index INT,
    source_line INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON smartkb.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.8 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `KB_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding 模型 |
| `KB_CHAT_MODEL` | `gpt-4o-mini` | 对话模型 |
| `KB_CHUNK_SIZE` | `1000` | 切块最大字符数 |
| `KB_CHUNK_OVERLAP` | `100` | 相邻块重叠字符数 |
| `KB_TOP_K` | `5` | 检索返回最大片段数 |
| `KB_CRON` | `0 3 * * *` | 定时索引 cron |

### 4.9 定时索引

- 每天凌晨 3 点(北京时间)全量重索引
- 支持 `POST /api/smartkb/ingest` 手动触发

---

## 五、首页 Logo

- 位置：`Landing.jsx` 的 `landing-intro` 区块顶部
- 图片：Oxelia51 logo SVG，透明背景
- 样式：`max-width: 120px; margin: 0 auto; display: block;`

---

## 六、导航栏变更

| 移除 | 替代方案 |
|------|---------|
| 导航栏「工具」链接 | 工具浮球展开列表 |
| 导航栏「管理」链接 | 保留，仅 `role=admin` 可见 |
| `/tools` 路由 | 保留，直接 URL 仍可访问 |

---

## 七、实现路线

| 阶段 | 内容 | 归属 |
|------|------|:--:|
| P1 | 工具浮球组件 + 扳手动画 + 展开/收起 + 拖动 + localStorage | Trae Work |
| P2 | SmartKB 浮球组件 + 星球动画 + 独立控制 | Trae Work |
| P3 | 导航栏精简 + App 根层级挂载 + 首页 logo | Trae Work |
| P4 | SmartKB 后端：pgvector + 文档摄入 + 代码解析 + 检索 API | Qoder |
| P5 | SmartKB 后端：RAG 对话 + SSE 流式 | Qoder |
| P6 | SmartKB 浮窗前端：双栏搜索 + 对话 + 流式渲染 | Trae Work |
| P7 | 定时索引 + 移动端适配 | Qoder + Trae Work |
| P8 | Codex 全量测试审查 | Codex |

---

## 八、未确认项

- 无。以上方案已于 2026-07-13 经开发者确认。

## 九、变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-07-13 | v1.0 | 初始设计，确认 |
