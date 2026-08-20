/**
 * oxelia51 fork 的「文档」入口。
 *
 * v4 起指向站内文档站 `/docs`（快速开始/桌面应用/云平台/使用指南/统计/告警/账户/FAQ）。
 * 全站约 228 处 docs 链接统一走此常量，改一行即全切。
 */
export const OXELIA_DOCS_URL = "/docs";

/**
 * 平台超级管理员邮箱曾硬编码在此（安全隐患：进了公开仓库，且被 UsersTab.tsx
 * 打进了管理后台的前端 JS bundle）。现改为服务端环境变量 OXELIA_SUPER_ADMIN_EMAIL
 * （见 env.mjs），只在服务端读取（adminAuth.ts），不再有任何客户端可达路径。
 */
