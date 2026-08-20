/**
 * 网站内容的硬编码默认值（管理台「内容编辑」未覆盖时的回退）。
 * 键与 oxelia51.site_content 表 / siteContentRouter 的 key 一致。
 * 页面读取流程：siteContent.get(key) → 命中返回 DB 内容，否则回退这里。
 */

export type ChangelogVersion = {
  tag: string;
  date: string;
  status?: "planned" | "released";
  summary: string;
  items: string[];
};

export const CHANGELOG_VERSIONS: ChangelogVersion[] = [
  {
    tag: "v0.1.9",
    date: "2026-08-13",
    status: "released",
    summary: "独立后台代理——关闭应用后代理网关继续运行",
    items: [
      "「独立后台代理」：代理复制到固定目录并开机自启，作为独立进程运行；关闭应用（托盘退出）后代理继续在线，AI 工具无需常开应用",
      "应用再次打开时自动复用现有代理，版本不同则自动换新；关闭开关即恢复「随应用运行」",
      "代理新增 -local / -port / -version 命令行参数；/api/proxy/status 返回 version 字段",
    ],
  },
  {
    tag: "v0.1.8",
    date: "2026-08-13",
    status: "released",
    summary: "Token 消耗计入缓存（Anthropic 缓存读/写单独落列）",
    items: [
      "修正 token 统计：Anthropic 的 input_tokens 不含缓存，此前缓存按计价倍数折算进总量（缓存读缩水 90%）；现 total 存原始 token（含缓存），缓存读/写细分单独落列",
      "成本口径不变（prompt 仍按计价折算）；云同步账本往返缓存细分字段",
    ],
  },
  {
    tag: "v0.1.7",
    date: "2026-08-13",
    status: "released",
    summary: "本地 Agent 检测 + 模型价格表独立导航 + 协议适配 + 清除数据",
    items: [
      "接入页「已检测到的工具」：自动扫描本机已安装的 AI Agent 并显示版本号",
      "模型价格参考独立为顶部导航 Tab，点击模型条目可编辑价格",
      "复制地址按协议适配：双协议供应商新增「Anthropic」按钮",
      "设置页新增「清除本地数据」；更新横幅直达当前平台安装包",
      "定价扩充（Claude 4.x / GPT-5.5 / 混元 Hy3）+ OpenAI Response API 记账",
      "修复「预算使用」添加预算无响应",
    ],
  },
  {
    tag: "v0.1.6",
    date: "2026-08-12",
    status: "released",
    summary: "Anthropic 路由 + Agent 识别增强 + 模型名归一化 + 总览显示模式",
    items: [
      "DeepSeek / 智谱新增 Anthropic 协议路由，Claude Code 可直接经本地代理记账",
      "Agent 自动识别新增 11 种客户端（gemini-cli、cline、roo-code 等）",
      "模型名 [1M]/[2M] 后缀归一化；未配置定价模型回退内置参考价",
      "总览新增「按模型」排行与「全部/Token/成本」显示模式 + 币种切换",
      "Agent 显示名别名；桌面字体整体放大；模型价格表新增「按输出价」排序",
      "修复日期范围不生效、非 2xx 落账、流式耗时、0-token 排行等 12 项",
    ],
  },
  {
    tag: "v0.1.5",
    date: "2026-08-11",
    status: "released",
    summary: "悬浮卡片细节调整",
    items: [
      "悬浮卡片移除不透明度调节（恢复固定玻璃拟态外观），保留今日模型 Top5、位置记忆与重置位置",
    ],
  },
  {
    tag: "网站更新",
    date: "2026-08-11",
    status: "released",
    summary: "管理台数据清理与下载量展示、工作台易用性修复、安全加固",
    items: [
      "管理台：「用户」Tab 新增废弃组织 / 空项目清理（逐项确认删除）；删除用户自动级联删除其独占的空组织",
      "管理台：「总览」Tab 新增桌面端下载量卡片；站点顶栏对已登录用户显示「进入工作台」",
      "工作台：五页体验修复（加载骨架、错误重试、空态行动按钮等）；供应商 / Agent 页对缺定价模型显示「未配置定价」；同步账本支持币种切换；登录后默认进入 /app",
      "站点：落地页与下载页展示 GitHub Releases 真实累计下载量；移动端菜单补登录 / 工作台入口；全站动效补齐（尊重 prefers-reduced-motion）",
      "安全：提交反馈增加按 IP 限流",
    ],
  },
  {
    tag: "v0.1.4",
    date: "2026-08-11",
    status: "released",
    summary: "悬浮卡片升级 + 自定义供应商体验优化 + 管理台内容编辑",
    items: [
      "悬浮卡片：今日模型 Top5 排名（前三名渐变）+ 可调透明度 + 主题实时切换 + 位置记忆",
      "自定义供应商：地址自动补全 https://，只需填域名/路径部分",
      "管理台新增「内容编辑」：更新日志 / 首页 Hero / 首页 FAQ 后台直接改，即时生效",
      "管理台权限统一邮箱制，清理 langfuse 组织/角色残留；/app 工作台加「管理台」入口",
      "首页 FAQ 答案卡片平滑展开动画",
    ],
  },
  {
    tag: "v4.0",
    date: "2026-08-09",
    status: "released",
    summary: "本地优先的个人 Token 记账本（P1–P4 完成）",
    items: [
      "落地页重构：主入口改为免费下载，弱化登录注册",
      "文档站上线：/docs 使用手册",
      "配色统一为黑 / 白 / 心跳红",
      "个人工作台 /app：总览 / 供应商 / Agent / 分析 / 设置",
      "桌面应用（Tauri 2，Windows/macOS/Linux）：本地代理 + 六屏界面（总览/接入/供应商/Agent/告警/设置）+ 成本核算 + 预算告警",
      "多设备同步：桌面端登录平台账户后上传 / 下载本地账本，多设备按事件去重合并；/app 设置页可查看同步账本与管理同步密钥",
    ],
  },
  {
    tag: "v3.x",
    date: "2026-08",
    status: "released",
    summary: "云平台上线",
    items: [
      "代理网关 + 项目密钥鉴权 + 接入引导",
      "预算告警（站内/邮件）、成本核算（CNY/USD）",
      "管理台 8 Tab：总览/反馈/用户/系统/安全/工具/告警/设置",
      "全站去 Langfuse 化：遥测 opt-in、外链清理、IP 白名单三层修复",
    ],
  },
  {
    tag: "v2.x",
    date: "2026-07",
    status: "released",
    summary: "早期工具与在线工具精简",
    items: [
      "在线工具精简：移除多个旧工具，保留 DormGuard/SecretStore/SmartKB",
      "账号体系、邮箱验证、JWT 认证",
      "API 网关与工具注册机制",
    ],
  },
];

export type FaqItem = { q: string; a: string };

export const LANDING_FAQ: FaqItem[] = [
  {
    q: "需要注册才能用吗？",
    a: "不需要。桌面应用全功能本地使用；云平台浏览不受限。登录仅用于跨设备同步、云托管与管理员管理。",
  },
  {
    q: "数据存在哪里？",
    a: "桌面应用的数据全部存在本地；使用云平台时数据存储在云端服务器。本地优先，数据由你掌控。",
  },
  {
    q: "需要 API Key 吗？",
    a: "不需要。只改代理地址即可，API Key 仍由你保管，请求只转发、不落库。",
  },
  {
    q: "支持哪些模型？",
    a: "内置 76 条供应商路由，覆盖国内（DeepSeek、智谱、通义、Kimi、豆包、混元、星火、MiniMax、硅基流动…）、国际（Anthropic、OpenAI、Gemini、Mistral、Grok、Groq…）与聚合平台（OpenRouter、Together…）；内置 72 个模型参考价，支持美元/人民币切换。改代理地址里的供应商 slug 即可切换，如 /api/proxy/deepseek、/api/proxy/zhipu。",
  },
  {
    q: "桌面应用什么时候发布？",
    a: "已发布 v0.1.9，支持 Windows / macOS / Linux 三平台。在下载页或 GitHub Releases 获取。",
  },
  {
    q: "关闭应用后，代理地址还能用吗？",
    a: "可以。在桌面端「设置 → 本地代理」开启「独立后台代理」后，代理会开机自启并在关闭应用后继续运行，AI 工具无需常开应用；关闭开关即恢复「随应用运行」。",
  },
  {
    q: "怎么自托管？",
    a: "一条 docker compose up -d 命令即可部署云平台，数据不离开你的服务器。",
  },
  {
    q: "和云平台是什么关系？",
    a: "桌面端负责本地记账与代理接入（无需登录）；云平台提供已同步数据的查看、备份与跨设备恢复。登录是可选能力，不同步你的 API Key 与请求内容。",
  },
  {
    q: "怎么反馈问题？",
    a: "通过站内反馈、邮箱 receive@oxelia51.com 或 GitHub Issues。",
  },
  {
    q: "怎么在多台设备间同步账本？",
    a: "在桌面端「设置 → 多设备同步」用云平台注册邮箱+密码登录，即可上传 / 下载本地账本；多设备按事件去重合并，仅在你主动点同步时数据上行。已同步的账本可在云平台「/app 设置 → 同步账本」查看。",
  },
  {
    q: "看文档 / 下载需要登录吗？",
    a: "都不需要。文档、下载、社区全部匿名开放。",
  },
];

export type HeroCopy = {
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
};

export const LANDING_HERO: HeroCopy = {
  badge: "本地优先 · 开源 MIT",
  title: "只需要改一行环境变量，所有 Token 消耗一目了然",
  subtitle:
    "本地部署 · 数据本地 · 按供应商和 Agent 统计。无论你使用 Claude、ChatGPT、DeepSeek 还是任何模型工具，每一次调用，用量、成本、异常自动落账。",
  ctaLabel: "免费下载",
};

/** 内容键 → 默认值（管理台「内容编辑」载入默认用） */
export const SITE_CONTENT_DEFAULTS: Record<string, unknown> = {
  changelog_versions: CHANGELOG_VERSIONS,
  landing_faq: LANDING_FAQ,
  landing_hero: LANDING_HERO,
};

/** 内容键 → 展示元信息（管理台「内容编辑」列表用） */
export const SITE_CONTENT_META: Record<
  string,
  { label: string; description: string }
> = {
  changelog_versions: {
    label: "更新日志",
    description:
      "/changelog 版本记录，JSON 数组 [{tag,date,status,summary,items[]}]",
  },
  landing_faq: {
    label: "首页 FAQ",
    description: "首页底部常见问题，JSON 数组 [{q,a}]",
  },
  landing_hero: {
    label: "首页 Hero",
    description: "首页首屏文案 {badge,title,subtitle,ctaLabel}",
  },
};
