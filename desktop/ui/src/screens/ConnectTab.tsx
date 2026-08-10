import { useCallback, useEffect, useState } from "react";
import { fetchCustomProviders, fetchProviders, type CustomProvider } from "../api";
import { ProviderCatalog } from "./ProviderCatalog";
import { CustomProviders } from "./CustomProviders";

/**
 * 接入：供应商预设目录（搜索 + 复制代理地址 + 打开官网）。
 * 高频动作独立成 Tab，配新工具时直接进。
 *
 * 目录交叉核验：/api/custom-providers 可用即新二进制，此时 /api/providers 返回
 * 真实路由清单（含 custom 标记），用于给查无路由的预设项打「未接入」标；
 * 接口不可用（旧二进制 / sidecar 未起）时降级：不核验、全部可点、自定义区块空态。
 */
export function ConnectTab() {
  const [custom, setCustom] = useState<CustomProvider[]>([]);
  const [routeSlugs, setRouteSlugs] = useState<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await fetchCustomProviders();
      setCustom(c.items ?? []);
    } catch {
      // 旧二进制 / sidecar 未起：降级为空态 + 不核验
      setCustom([]);
      setRouteSlugs(null);
      return;
    }
    try {
      const r = await fetchProviders();
      const slugs = new Set((r.providers ?? []).map((p) => p.name));
      // 空集合视为未知（旧响应无用量时为空），不核验，避免全量误标
      setRouteSlugs(slugs.size > 0 ? slugs : null);
    } catch {
      setRouteSlugs(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1 className="page-title">接入</h1>
      <p className="page-sub">
        选择你使用的 LLM 供应商，复制代理地址；把模型工具的 Base URL 指向它即可开始记账。点击卡片打开官网。
      </p>
      <div className="card">
        <ProviderCatalog custom={custom} routeSlugs={routeSlugs} />
      </div>
      <CustomProviders items={custom} onChanged={() => void load()} />
    </>
  );
}
