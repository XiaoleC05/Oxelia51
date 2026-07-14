# SuperRead API Key 在前端日志中被明文打印

- **场景**：用户在 SuperRead 订阅管理页输入 OpenAI API Key 时，浏览器 Console 出现完整明文 key
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`src/pages/SuperRead.jsx` 中 `console.log('user api key:', apiKey)` 直接打印用户输入，开发期遗留调试代码未清理
- **修复方案**：删除调试 log；同时审查所有调用 `apiKey` 的位置，仅保留必要传递，不在前端日志/状态中暴露
- **结果**：浏览器 Console 不再出现明文 API Key；通过 DevTools Network 面板确认 Authorization header 仍正常携带
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/a1b2c3d`
- **日期**：2026-07-02
