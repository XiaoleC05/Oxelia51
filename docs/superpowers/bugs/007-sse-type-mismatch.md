# SmartKB SSE 事件 type 字段大小写不匹配导致前端不渲染

- **场景**：用户在 SmartKB 浮窗提问后，后端流式返回 token，但前端永远停留在「思考中」状态
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：后端 `backend/internal/smartkb/chat.go` 发送 `data: {"type":"Token",...}`，首字母大写；前端 `SmartKBWidget.jsx` 解析时判断 `event.type === 'token'` 全小写，导致所有 token 被丢弃
- **修复方案**：统一前后端 type 字段为小写蛇形命名；后端发送 `token`/`sources`/`done`/`error`；前端解析时不再做 toLowerCase 兜底，保证类型严格匹配
- **结果**：流式回答能逐 token 渲染；引用按钮正常出现
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/a7b8c9d`
- **日期**：2026-07-09
