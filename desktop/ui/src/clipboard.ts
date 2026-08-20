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
 * 参考 CC Switch 预设供应商目录，按 国外主流 / 国内主流 / 第三方平台 三分类。
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
        slug: "mistral",
        label: "Mistral",
        anthropic: false,
        url: "https://mistral.ai",
      },
      {
        slug: "xai",
        label: "xAI (Grok)",
        anthropic: false,
        url: "https://x.ai",
      },
      {
        slug: "groq",
        label: "Groq",
        anthropic: false,
        url: "https://groq.com",
      },
      {
        slug: "cerebras",
        label: "Cerebras",
        anthropic: false,
        url: "https://www.cerebras.ai",
      },
      {
        slug: "cohere",
        label: "Cohere",
        anthropic: false,
        url: "https://cohere.com",
      },
      {
        slug: "perplexity",
        label: "Perplexity",
        anthropic: false,
        url: "https://www.perplexity.ai",
      },
      {
        slug: "sambanova",
        label: "SambaNova",
        anthropic: false,
        url: "https://sambanova.ai",
      },
      {
        slug: "nebius",
        label: "Nebius",
        anthropic: false,
        url: "https://nebius.com",
      },
      {
        slug: "ai21",
        label: "AI21",
        anthropic: false,
        url: "https://www.ai21.com",
      },
      {
        slug: "hyperbolic",
        label: "Hyperbolic",
        anthropic: false,
        url: "https://hyperbolic.xyz",
      },
      {
        slug: "friendli",
        label: "FriendliAI",
        anthropic: false,
        url: "https://friendli.ai",
      },
      {
        slug: "nvidia",
        label: "NVIDIA",
        anthropic: false,
        url: "https://build.nvidia.com",
      },
      {
        slug: "github-models",
        label: "GitHub Models",
        anthropic: false,
        url: "https://github.com/features/copilot",
      },
      {
        slug: "minimax-io",
        label: "MiniMax 国际版",
        anthropic: false,
        url: "https://platform.minimax.io",
      },
      {
        slug: "zai",
        label: "Z.ai (GLM 国际)",
        anthropic: false,
        url: "https://z.ai",
      },
      {
        slug: "stepfun-ai",
        label: "StepFun 国际版",
        anthropic: false,
        url: "https://platform.stepfun.ai",
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
        slug: "spark",
        label: "讯飞星火 (Spark)",
        anthropic: false,
        url: "https://xinghuo.xfyun.cn",
      },
      {
        slug: "minimax",
        label: "MiniMax 国内版",
        anthropic: false,
        url: "https://platform.minimaxi.com",
      },
      {
        slug: "baichuan",
        label: "百川 (Baichuan)",
        anthropic: false,
        url: "https://www.baichuan-ai.com",
      },
      {
        slug: "yi",
        label: "零一万物 (Yi)",
        anthropic: false,
        url: "https://www.lingyiwanwu.com",
      },
      {
        slug: "sensenova",
        label: "商汤日日新 (SenseNova)",
        anthropic: false,
        url: "https://platform.sensenova.cn",
      },
      {
        slug: "stepfun",
        label: "阶跃星辰 (StepFun)",
        anthropic: false,
        url: "https://platform.stepfun.com",
      },
      {
        slug: "siliconflow",
        label: "硅基流动 (SiliconFlow)",
        anthropic: false,
        url: "https://siliconflow.cn",
      },
      {
        slug: "gitee",
        label: "码云 AI (Gitee)",
        anthropic: false,
        url: "https://ai.gitee.com",
      },
      {
        slug: "modelscope",
        label: "魔搭 (ModelScope)",
        anthropic: false,
        url: "https://modelscope.cn",
      },
      {
        slug: "baidu-qianfan",
        label: "百度千帆",
        anthropic: false,
        url: "https://cloud.baidu.com/product/qianfan_modelbuilder",
      },
    ],
  },
  {
    group: "第三方平台",
    providers: [
      {
        slug: "openrouter",
        label: "OpenRouter",
        anthropic: false,
        url: "https://openrouter.ai",
      },
      {
        slug: "together",
        label: "Together AI",
        anthropic: false,
        url: "https://www.together.ai",
      },
      {
        slug: "fireworks",
        label: "Fireworks AI",
        anthropic: false,
        url: "https://fireworks.ai",
      },
      {
        slug: "deepinfra",
        label: "DeepInfra",
        anthropic: false,
        url: "https://deepinfra.com",
      },
      {
        slug: "novita",
        label: "Novita",
        anthropic: false,
        url: "https://novita.ai",
      },
      {
        slug: "featherless",
        label: "Featherless",
        anthropic: false,
        url: "https://featherless.ai",
      },
      {
        slug: "ppio",
        label: "PPIO (算力平台)",
        anthropic: false,
        url: "https://ppio.cn",
      },
      {
        slug: "packyapi",
        label: "PackyAPI",
        anthropic: false,
        url: "https://www.packyapi.ai",
      },
      {
        slug: "zetaapi",
        label: "ZetaAPI",
        anthropic: false,
        url: "https://zetaapi.ai",
      },
      {
        slug: "apinebula",
        label: "APINebula",
        anthropic: false,
        url: "https://apinebula.ai",
      },
      {
        slug: "aicodemirror",
        label: "AICodeMirror",
        anthropic: false,
        url: "https://www.aicodemirror.ai",
      },
      {
        slug: "pateway",
        label: "Pateway",
        anthropic: false,
        url: "https://pateway.ai",
      },
      {
        slug: "fenno",
        label: "Fenno",
        anthropic: false,
        url: "https://api.fenno.ai",
      },
      {
        slug: "runapi",
        label: "RunAPI",
        anthropic: false,
        url: "https://runapi.co",
      },
      {
        slug: "shengsuanyun",
        label: "胜算云",
        anthropic: false,
        url: "https://www.shengsuanyun.com",
      },
      {
        slug: "aigocode",
        label: "AIGO Code",
        anthropic: false,
        url: "https://aigocode.app",
      },
      {
        slug: "aicoding",
        label: "AICoding",
        anthropic: false,
        url: "https://aicoding.inc",
      },
      {
        slug: "subrouter",
        label: "SubRouter",
        anthropic: false,
        url: "https://subrouter.ai",
      },
      {
        slug: "apikeyfun",
        label: "APIKey.fun",
        anthropic: false,
        url: "https://apikey.fun",
      },
      {
        slug: "apito",
        label: "Apito",
        anthropic: true,
        url: "https://www.apito.ai",
      },
      {
        slug: "code0",
        label: "Code0",
        anthropic: false,
        url: "https://code0.ai",
      },
      {
        slug: "teamorouter",
        label: "TeamoRouter",
        anthropic: false,
        url: "https://teamorouter.com",
      },
      {
        slug: "claudecn",
        label: "ClaudeCN",
        anthropic: true,
        url: "https://claudecn.top",
      },
      {
        slug: "a6api",
        label: "A6 API",
        anthropic: false,
        url: "https://www.a6api.com",
      },
      {
        slug: "atlascloud",
        label: "AtlasCloud",
        anthropic: false,
        url: "https://www.atlascloud.ai",
      },
      {
        slug: "compshare",
        label: "Compshare",
        anthropic: false,
        url: "https://www.compshare.cn",
      },
      {
        slug: "ccsub",
        label: "CCSub",
        anthropic: false,
        url: "https://www.ccsub.net",
      },
      {
        slug: "sssaicodeapi",
        label: "SSSAI Code API",
        anthropic: false,
        url: "https://sssaicodeapi.com",
      },
      {
        slug: "micuapi",
        label: "MicuAPI",
        anthropic: false,
        url: "https://www.micuapi.ai",
      },
      {
        slug: "rightapi",
        label: "RightAPI",
        anthropic: false,
        url: "https://www.rightapi.ai",
      },
      { slug: "etok", label: "ETOK", anthropic: false, url: "https://etok.ai" },
      {
        slug: "cubence",
        label: "Cubence",
        anthropic: false,
        url: "https://cubence.com",
      },
      {
        slug: "crazyrouter",
        label: "CrazyRouter",
        anthropic: false,
        url: "https://www.crazyrouter.com",
      },
      {
        slug: "dmxapi",
        label: "DMX API",
        anthropic: false,
        url: "https://www.dmxapi.cn",
      },
      {
        slug: "sudocode",
        label: "SudoCode",
        anthropic: false,
        url: "https://sudocode.chat",
      },
      {
        slug: "aihubmix",
        label: "AIHubMix",
        anthropic: false,
        url: "https://aihubmix.com",
      },
      { slug: "amux", label: "Amux", anthropic: false, url: "https://amux.ai" },
      {
        slug: "cherryin",
        label: "CherryIn",
        anthropic: false,
        url: "https://open.cherryin.ai",
      },
      {
        slug: "eflowcode",
        label: "E-FlowCode",
        anthropic: false,
        url: "https://e-flowcode.cc",
      },
      {
        slug: "streamlake",
        label: "StreamLake",
        anthropic: false,
        url: "https://console.streamlake.ai",
      },
      {
        slug: "longcat",
        label: "LongCat",
        anthropic: false,
        url: "https://longcat.chat",
      },
      {
        slug: "opencode",
        label: "OpenCode",
        anthropic: false,
        url: "https://opencode.ai",
      },
      {
        slug: "pipellm",
        label: "PipeLLM",
        anthropic: false,
        url: "https://code.pipellm.ai",
      },
      {
        slug: "relaxycode",
        label: "RelaxyCode",
        anthropic: false,
        url: "https://www.relaxycode.com",
      },
      {
        slug: "therouter",
        label: "TheRouter",
        anthropic: false,
        url: "https://therouter.ai",
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

/** 生成某供应商的 export 配置命令（Anthropic 协议 vs OpenAI 兼容协议）。
 * 原生 anthropic 协议的供应商（anthropic / kimi-for-coding / apito 等）直接走基础 slug，
 * 无需 /anthropic 后缀；需要后缀的变体地址由接入页的「Anthropic」按钮单独提供。 */
export function providerCmd(slug: string, anthropic: boolean): string {
  return anthropic
    ? `export ANTHROPIC_BASE_URL="${proxyUrl(slug)}"`
    : `export OPENAI_BASE_URL="${proxyUrl(slug)}"`;
}
