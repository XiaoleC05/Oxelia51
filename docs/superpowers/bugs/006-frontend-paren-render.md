# 前端解析文章正文时括号未转义导致 JSX 渲染崩溃

- **场景**：博客文章中包含 `<test>` 字符串时，访问 `/blog/:id` 页面整页白屏
- **发现 Agent**：Claude Code
- **修复 Agent**：Qoder
- **根因**：`src/pages/BlogPost.jsx` 使用 `dangerouslySetInnerHTML` 直接渲染后端返回的 Markdown HTML，未对尖括号做转义；`<test>` 被浏览器解析为未知标签
- **修复方案**：改用 `marked` 解析 Markdown 后通过 DOMPurify 净化，再 `dangerouslySetInnerHTML`；移除直接拼接 HTML 的代码路径
- **结果**：包含尖括号、HTML 标签的特殊字符文章正文能正常显示；XSS 风险同时消除
- **提交**：`https://github.com/XiaoleC05/Oxelia51/commit/f6a7b8c`
- **日期**：2026-07-08
