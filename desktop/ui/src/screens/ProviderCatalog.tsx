import { useMemo, useState } from "react";
import {
  PROVIDER_GROUPS,
  API_FORMATS,
  formatBaseUrl,
  copyText,
  type ApiFormat,
  type ProviderDef,
} from "../clipboard";
import type { CustomProvider } from "../api";
import { openExternal } from "../openExternal";

/** 自定义供应商 → 目录卡片模型（复用 provider-cell 渲染与复制逻辑）。 */
function customToDef(p: CustomProvider): ProviderDef {
  return {
    slug: p.slug,
    label: p.name,
    anthropic: p.protocol === "anthropic",
    url: p.baseUrl,
  };
}

/**
 * CC Switch 风格预设供应商面板：按 国外主流 / 国内主流 分组平铺，
 * 支持搜索过滤；点击卡片打开官网。
 * 每个供应商提供主流三种请求格式选项（OpenAI 补全 / OpenAI 响应 / Anthropic 消息），
 * 选择后「复制地址」按格式给出对应 base URL（messages 对变体供应商带 /anthropic 后缀）；
 * 不支持的格式置灰——网关为透传代理，格式可用性 = 上游官方端点支持，
 * 由后端 /api/providers 的 formats 字段下发（单一数据源），旧二进制降级为本地推导。
 *
 * 交叉核验：routeSlugs 为后端 /api/providers 返回的真实路由集合；
 * 查无路由的预设项置灰 + 「未接入」标，复制按钮禁用，杜绝静默 404。
 * routeSlugs 为 null（sidecar 未起 / 旧二进制）时不核验，全部可点（现状行为），不反向误伤。
 * custom 为用户自定义供应商，追加为「自定义」分组渲染。
 */

type CellProps = {
  p: ProviderDef;
  off: boolean;
  isCustom: boolean;
  /** 该供应商支持的格式（调用方已含后端/降级推导） */
  supported: ApiFormat[];
  copied: string | null;
  onCopy: (text: string, key: string) => void;
};

/** 单个供应商卡片：名称 + slug + 三格式单选（各带说明）+ 复制地址/官网。 */
function ProviderCell({ p, off, isCustom, supported, copied, onCopy }: CellProps) {
  // 选中态容错：formats 后到时若旧选中项不再支持，回落到首个支持项
  const [picked, setPicked] = useState<ApiFormat | null>(null);
  const fmt = picked && supported.includes(picked) ? picked : supported[0];
  const meta = API_FORMATS.find((f) => f.id === fmt) ?? API_FORMATS[0];
  // messages 变体：非原生 anthropic 却支持 messages（即 deepseek/zhipu 兼容端点）
  const variant = !p.anthropic && supported.includes("messages");
  const url = formatBaseUrl(p.slug, fmt, variant);
  const copyKey = `${p.slug}-${fmt}`;

  return (
    <div
      className={`provider-cell${off ? " off" : ""}${isCustom ? " static" : ""}`}
      role={isCustom ? undefined : "link"}
      tabIndex={isCustom ? undefined : 0}
      onClick={isCustom ? undefined : () => void openExternal(p.url)}
      onKeyDown={
        isCustom
          ? undefined
          : (e) => {
              if (e.key === "Enter") void openExternal(p.url);
            }
      }
      title={isCustom ? p.url : `打开 ${p.label} 官网`}
    >
      <span className="provider-cell-name">
        {p.label}
        {off && <span className="dim-tag">未接入</span>}
        {isCustom && (
          <span className="dim-tag">{p.anthropic ? "Anthropic" : "OpenAI"}</span>
        )}
      </span>
      <span className="provider-cell-slug">{p.slug}</span>
      <div
        className="provider-cell-formats"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="radiogroup"
        aria-label={`${p.label} 请求格式`}
      >
        {API_FORMATS.map((f) => {
          const ok = supported.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={fmt === f.id}
              className={`fmt${fmt === f.id ? " active" : ""}`}
              disabled={off || !ok}
              title={
                !ok
                  ? `${p.label} 上游暂无 ${f.label} 端点（网关透传，不做协议转换）`
                  : `${f.label}（${f.path}）：${f.note}`
              }
              onClick={() => setPicked(f.id)}
            >
              <span className="fmt-label">{f.label}</span>
              <span className="fmt-note">{ok ? f.note : "不支持"}</span>
            </button>
          );
        })}
      </div>
      <span
        className="provider-cell-endpoint"
        title={`客户端按此端点调用：${url}${meta.path}（「复制地址」复制的是 Base URL，SDK 自动拼路径）`}
      >
        {url}
        <span className="dim">{meta.path}</span>
      </span>
      <div className="provider-cell-actions">
        <button
          type="button"
          className="provider-cell-copy"
          disabled={off}
          onClick={(e) => {
            e.stopPropagation();
            if (!off) onCopy(url, copyKey);
          }}
          title={
            off
              ? "该平台暂未接入，可用自定义供应商自行添加"
              : `复制 ${meta.label} 协议 Base URL：${url}`
          }
        >
          {copied === copyKey ? "已复制 ✓" : "复制地址"}
        </button>
        {!isCustom && (
          <button
            type="button"
            className="provider-cell-site"
            onClick={(e) => {
              e.stopPropagation();
              void openExternal(p.url);
            }}
            title={`在浏览器打开 ${p.label} 官网`}
          >
            官网
            <svg
              viewBox="0 0 12 12"
              width="10"
              height="10"
              aria-hidden="true"
            >
              <path
                d="M2 10 10 2M4 2h6v6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function ProviderCatalog({
  custom = [],
  routeSlugs = null,
  anthropicVariants = null,
  formats = null,
}: {
  custom?: CustomProvider[];
  routeSlugs?: Set<string> | null;
  anthropicVariants?: Set<string> | null;
  /** 后端下发的各 slug 支持格式；null（旧二进制）时按既有口径本地推导 */
  formats?: Record<string, string[]> | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const copy = async (text: string, key: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  // 某预设供应商支持的格式：后端 formats 优先；旧二进制降级为本地推导
  // （anthropic=true → messages；其余 → chat；anthropicVariants 命中 → 追加 messages）。
  const supportedOf = (p: ProviderDef, isCustom: boolean): ApiFormat[] => {
    if (isCustom) return p.anthropic ? ["messages"] : ["chat"];
    const fromApi = formats?.[p.slug];
    if (fromApi && fromApi.length > 0) return fromApi as ApiFormat[];
    const f: ApiFormat[] = p.anthropic ? ["messages"] : ["chat"];
    if (!p.anthropic && anthropicVariants?.has(p.slug)) f.push("messages");
    return f;
  };

  // 搜索过滤：按 label / slug 匹配，忽略大小写
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const match = (p: ProviderDef) =>
      p.label.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    const list = PROVIDER_GROUPS.map((g) => ({
      ...g,
      providers: q ? g.providers.filter(match) : g.providers,
    })).filter((g) => g.providers.length > 0);
    const customs = custom.map(customToDef);
    const visibleCustoms = q ? customs.filter(match) : customs;
    if (visibleCustoms.length > 0) {
      list.push({ group: "自定义", providers: visibleCustoms });
    }
    return list;
  }, [q, custom]);

  return (
    <div className="provider-catalog">
      <div className="provider-search">
        <input
          className="input grow"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索供应商（如 deepseek、kimi、qwen）…"
          aria-label="搜索供应商"
        />
      </div>
      {groups.length === 0 ? (
        <p className="empty">未找到匹配的供应商。</p>
      ) : (
        groups.map((g) => (
          <div key={g.group} className="proxy-group">
            <h3 className="proxy-group-title">{g.group}</h3>
            <div className="provider-grid">
              {g.providers.map((p) => {
                const isCustom = g.group === "自定义";
                // 仅核验预设项；自定义项由后端注册，必然有路由
                const off =
                  !isCustom && routeSlugs !== null && !routeSlugs.has(p.slug);
                return (
                  <ProviderCell
                    key={p.slug}
                    p={p}
                    off={off}
                    isCustom={isCustom}
                    supported={supportedOf(p, isCustom)}
                    copied={copied}
                    onCopy={(text, key) => void copy(text, key)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
