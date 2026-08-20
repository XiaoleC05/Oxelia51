import { useMemo, useState } from "react";
import {
  PROVIDER_GROUPS,
  proxyUrl,
  anthropicVariantUrl,
  copyText,
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
 * CC Switch 风格预设供应商面板：按 国外主流 / 国内主流 / 第三方平台 分组平铺，
 * 支持搜索过滤；点击卡片打开官网，悬停出现「复制地址」按钮。
 * 置于首页「快速接入」，便于随手复制与直达官网。
 *
 * 交叉核验：routeSlugs 为后端 /api/providers 返回的真实路由集合；
 * 查无路由的预设项置灰 + 「未接入」标，复制按钮禁用，杜绝静默 404。
 * routeSlugs 为 null（sidecar 未起 / 旧二进制）时不核验，全部可点（现状行为），不反向误伤。
 * custom 为用户自定义供应商，追加为「自定义」分组渲染。
 */
export function ProviderCatalog({
  custom = [],
  routeSlugs = null,
  anthropicVariants = null,
}: {
  custom?: CustomProvider[];
  routeSlugs?: Set<string> | null;
  anthropicVariants?: Set<string> | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const copy = async (text: string, key: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
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
          placeholder="搜索供应商（如 deepseek、kimi、zai）…"
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
                  <div
                    key={p.slug}
                    className={`provider-cell${off ? " off" : ""}${isCustom ? " static" : ""}`}
                    role={isCustom ? undefined : "link"}
                    tabIndex={isCustom ? undefined : 0}
                    onClick={
                      isCustom ? undefined : () => void openExternal(p.url)
                    }
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
                        <span className="dim-tag">
                          {p.anthropic ? "Anthropic" : "OpenAI"}
                        </span>
                      )}
                    </span>
                    <span className="provider-cell-slug">{p.slug}</span>
                    <div className="provider-cell-actions">
                      <button
                        type="button"
                        className="provider-cell-copy"
                        disabled={off}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!off) void copy(proxyUrl(p.slug), p.slug);
                        }}
                        title={
                          off
                            ? "该平台暂未接入，可用自定义供应商自行添加"
                            : `复制 OpenAI 兼容协议地址：${proxyUrl(p.slug)}`
                        }
                      >
                        {copied === p.slug ? "已复制 ✓" : "复制地址"}
                      </button>
                      {anthropicVariants?.has(p.slug) && (
                        <button
                          type="button"
                          className="provider-cell-copy alt"
                          disabled={off}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!off)
                              void copy(
                                anthropicVariantUrl(p.slug),
                                `${p.slug}-anthropic`,
                              );
                          }}
                          title={`复制 Anthropic Messages 协议地址（Claude Code 用）：${anthropicVariantUrl(p.slug)}`}
                        >
                          {copied === `${p.slug}-anthropic`
                            ? "已复制 ✓"
                            : "Anthropic"}
                        </button>
                      )}
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
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
