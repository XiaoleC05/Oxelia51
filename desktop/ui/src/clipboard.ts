// 剪贴板复制（Tauri webview 优先原生 clipboard API，失败退回 execCommand）。

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * 本地 sidecar 代理地址与一键配置命令（复制给模型工具用）。
 * 注意：代理路由注册在 /api/proxy/<slug>/ 下（见 registry.go），BASE_URL 必须含该前缀，
 * 否则 SDK 追加 /v1/messages 后命中 404、完全不落账。
 */
export const PROXY_BASE = "http://127.0.0.1:17800/api/proxy";

/**
 * 路由可用性以 /api/providers 为准；自定义供应商见设置。
 * 内置 11 家供应商，按 国外主流 / 国内主流 两分类；其他平台用自定义供应商接入。
 * anthropic=true 表示该供应商走 Anthropic 协议（ANTHROPIC_BASE_URL）；其余走 OpenAI 兼容协议。
 * url 为该供应商官网（卡片点击跳转用）。
 */
export type ProviderDef = {
  slug: string;
  label: string;
  anthropic: boolean;
  url: string;
};

/** 供应商分组（CC Switch 风格预设目录）。 */
export const PROVIDER_GROUPS: { group: string; providers: ProviderDef[] }[] = [
  {
    group: "国外主流",
    providers: [
      {
        slug: "anthropic",
        label: "Claude (Anthropic)",
        anthropic: true,
        url: "https://www.anthropic.com/claude-code",
      },
      {
        slug: "openai",
        label: "OpenAI / ChatGPT",
        anthropic: false,
        url: "https://openai.com",
      },
      {
        slug: "gemini",
        label: "Google Gemini",
        anthropic: false,
        url: "https://ai.google.dev/gemini-api",
      },
      {
        slug: "xai",
        label: "xAI (Grok)",
        anthropic: false,
        url: "https://x.ai",
      },
    ],
  },
  {
    group: "国内主流",
    providers: [
      {
        slug: "deepseek",
        label: "DeepSeek",
        anthropic: false,
        url: "https://platform.deepseek.com",
      },
      {
        slug: "zhipu",
        label: "智谱 GLM",
        anthropic: false,
        url: "https://open.bigmodel.cn",
      },
      {
        slug: "qwen",
        label: "通义千问 (Qwen)",
        anthropic: false,
        url: "https://bailian.console.aliyun.com",
      },
      {
        slug: "moonshot",
        label: "Moonshot (Kimi)",
        anthropic: false,
        url: "https://platform.kimi.com",
      },
      {
        slug: "kimi-for-coding",
        label: "Kimi For Coding",
        anthropic: true,
        url: "https://www.kimi.com/code/",
      },
      {
        slug: "doubao",
        label: "豆包 / 火山方舟 (Doubao)",
        anthropic: false,
        url: "https://console.volcengine.com/ark",
      },
      {
        slug: "hunyuan",
        label: "腾讯混元 (Hunyuan)",
        anthropic: false,
        url: "https://hunyuan.tencent.com",
      },
      {
        slug: "minimax",
        label: "MiniMax 国内版",
        anthropic: false,
        url: "https://platform.minimaxi.com",
      },
    ],
  },
];

/** 扁平化全部供应商（空态默认选 Claude）。 */
export const PROVIDER_COMMANDS: ProviderDef[] = PROVIDER_GROUPS.flatMap(
  (g) => g.providers,
);

/** 某供应商的代理地址（直接填写用，如自定义 Base URL 的界面）。 */
export function proxyUrl(slug: string): string {
  return `${PROXY_BASE}/${slug}`;
}

/** 某供应商的 Anthropic 协议变体地址（/anthropic 后缀路由，供 Claude Code 等客户端）。
 * 哪些供应商有此变体由后端 /api/providers 返回的 anthropicVariants 决定（单一数据源），
 * 前端不再硬编码名单——避免与 registry.go 的 anthropicEndpoints 两处漂移。 */
export function anthropicVariantUrl(slug: string): string {
  return `${proxyUrl(slug)}/anthropic`;
}

/** 请求格式 ID（与后端 registry.ProviderFormats 对齐）：
 * OpenAI 占两个主流格式（chat 补全 / responses 响应），Anthropic 占一个（messages 消息）。 */
export type ApiFormat = "chat" | "responses" | "messages";

export type ApiFormatDef = {
  id: ApiFormat;
  label: string;
  /** 该格式在上游的端点路径（SDK 按协议自动拼接，仅作展示与说明） */
  path: string;
  /** 格式区别的简要说明（接入页选项后展示） */
  note: string;
};

/** 主流三种请求格式目录。 */
export const API_FORMATS: ApiFormatDef[] = [
  {
    id: "chat",
    label: "OpenAI 补全",
    path: "/v1/chat/completions",
    note: "最通用的对话接口，工具默认支持",
  },
  {
    id: "responses",
    label: "OpenAI 响应",
    path: "/v1/responses",
    note: "新一代接口，多数厂商已支持",
  },
  {
    id: "messages",
    label: "Anthropic 消息",
    path: "/v1/messages",
    note: "Claude Code 专用协议",
  },
];

/** 某格式对应的代理 base URL：messages 对走变体的供应商（deepseek/zhipu）带
 * /anthropic 后缀；chat 与 responses 共用基础 slug 地址（同属 OpenAI /v1 命名空间，
 * SDK 按调用方法自动拼 /chat/completions 或 /responses）。 */
export function formatBaseUrl(
  slug: string,
  format: ApiFormat,
  variant: boolean,
): string {
  return format === "messages" && variant
    ? anthropicVariantUrl(slug)
    : proxyUrl(slug);
}

/** 生成某供应商的 export 配置命令（Anthropic 协议 vs OpenAI 兼容协议）。
 * 原生 anthropic 协议的供应商（anthropic / kimi-for-coding）直接走基础 slug，
 * 无需 /anthropic 后缀；需要后缀的变体地址由接入页的「Anthropic」按钮单独提供。 */
export function providerCmd(slug: string, anthropic: boolean): string {
  return anthropic
    ? `export ANTHROPIC_BASE_URL="${proxyUrl(slug)}"`
    : `export OPENAI_BASE_URL="${proxyUrl(slug)}"`;
}
