import { useCallback, useEffect, useState } from "react";
import {
  clearData,
  cloudLogin,
  fetchPricing,
  fetchPricingDefaults,
  fetchSettings,
  postSync,
  proxyCtl,
  saveSetting,
  type PricedItem,
  type ProxyStatus,
  type Settings,
} from "../api";
import { WIDGET_FIELDS } from "../widget/WidgetApp";
import { openExternal } from "../openExternal";

/** 关于区外链（与官网 / GitHub 保持一致，可点击跳转）。 */
const SITE_URL = "https://oxelia51.com";
const GITHUB_URL = "https://github.com/XiaoleC05/Oxelia51";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="about-link"
      onClick={(e) => {
        e.preventDefault();
        void openExternal(href);
      }}
    >
      {children} ↗
    </a>
  );
}

/** 同步状态机：空闲 → 进行中（按钮禁点）→ 成功 / 失败（可重试）/ 冲突（优先于成功）。 */
type SyncStatus =
  | { kind: "idle" }
  | { kind: "busy"; action: "login" | "upload" | "download" }
  | { kind: "ok"; label: string }
  | { kind: "fail"; label: string }
  | { kind: "conflict"; label: string };

function syncBusyLabel(action: "login" | "upload" | "download"): string {
  return action === "login"
    ? "登录中…"
    : action === "upload"
      ? "上传中…"
      : "下载中…";
}

export function SettingsTab({
  theme,
  onTheme,
  appVersion,
}: {
  theme: string;
  onTheme: (t: "cosmos" | "cozy") => void;
  appVersion: string;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pricing, setPricing] = useState<PricedItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: "idle" });
  const syncBusy = syncStatus.kind === "busy";
  // 悬浮卡片显示字段（默认全部）
  const [widgetFields, setWidgetFields] = useState<string[]>(
    WIDGET_FIELDS.map((f) => f.key),
  );
  const [clearing, setClearing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  // 独立后台代理状态
  const [proxy, setProxy] = useState<ProxyStatus>({
    enabled: false,
    running: false,
    version: "",
  });
  const [proxyBusy, setProxyBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([fetchSettings(), fetchPricing()]);
      setSettings(s);
      setPricing(p.pricing ?? []);
      setWidgetFields(
        s.widgetFields?.length
          ? s.widgetFields
          : WIDGET_FIELDS.map((f) => f.key),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setTheme = async (t: "cosmos" | "cozy") => {
    onTheme(t);
    try {
      await saveSetting("theme", t);
    } catch {
      // ignore
    }
  };

  // 独立后台代理：查询状态 / 开启 / 关闭
  const refreshProxy = useCallback(async () => {
    setProxy(await proxyCtl("status"));
  }, []);
  useEffect(() => {
    void refreshProxy();
  }, [refreshProxy]);

  const toggleProxy = async () => {
    setProxyBusy(true);
    try {
      setProxy(await proxyCtl(proxy.enabled ? "uninstall" : "install"));
    } finally {
      setProxyBusy(false);
    }
  };

  // 清除本地用量数据：二次确认（WebView 的 window.confirm 不可靠，用状态机代替）
  const doClearData = async () => {
    if (!confirming) {
      setConfirming(true);
      setClearMsg("");
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setConfirming(false);
    setClearing(true);
    try {
      const r = await clearData();
      setClearMsg(`已清除 ${r.deleted} 条用量记录。`);
      void load();
    } catch (e) {
      setClearMsg(e instanceof Error ? e.message : "清除失败");
    } finally {
      setClearing(false);
    }
  };

  // 悬浮卡片显示字段：勾选即时保存
  const toggleWidgetField = (key: string) => {
    setWidgetFields((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      void saveSetting("widget_fields", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const savePricing = async () => {
    try {
      await saveSetting("pricing", JSON.stringify(pricing));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  const setPrice = (i: number, field: keyof PricedItem, v: string) => {
    setPricing((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: v } : p)),
    );
  };

  const addPrice = () => {
    setPricing((prev) => [...prev, { model: "", prompt: "", completion: "" }]);
  };

  const removePrice = (i: number) => {
    setPricing((prev) => prev.filter((_, idx) => idx !== i));
  };

  // 一键填入内置常见模型参考价（空表起步的快捷入口；仍点「保存定价」才生效）
  const fillDefaults = async () => {
    try {
      const d = await fetchPricingDefaults();
      setPricing(d.pricing ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载参考价失败");
    }
  };

  // 登录云同步账户（web 平台，账户 = 云平台注册邮箱）：token 存进本地设置，之后 sidecar 用它做同步
  const doLogin = async () => {
    if (!account.trim() || !password) {
      setSyncStatus({ kind: "fail", label: "请输入账户和密码" });
      return;
    }
    setSyncStatus({ kind: "busy", action: "login" });
    try {
      const token = await cloudLogin(account.trim(), password);
      await Promise.all([
        saveSetting("sync_token", token),
        saveSetting("sync_account", account.trim()),
      ]);
      setSyncStatus({
        kind: "ok",
        label: `已登录 ${account.trim()}，可开始同步`,
      });
      setPassword("");
      void load(); // 刷新为已登录视图（显示同步按钮）
    } catch (e) {
      setSyncStatus({
        kind: "fail",
        label: e instanceof Error ? e.message : "登录失败",
      });
    }
  };

  const doSync = async (action: "upload" | "download") => {
    setSyncStatus({ kind: "busy", action });
    try {
      const r = await postSync(action);
      const n = (action === "upload" ? r.uploaded : r.downloaded) ?? 0;
      if ((r.conflicts ?? 0) > 0) {
        // 冲突优先于成功：event_id 去重合并时发现同 id 不同内容（防御性检测，正常恒 0）
        setSyncStatus({
          kind: "conflict",
          label: `完成，其中 ${r.conflicts} 条与云端不一致，已保留先到版本`,
        });
      } else {
        setSyncStatus({
          kind: "ok",
          label: action === "upload" ? `已上传 ${n} 条` : `已下载 ${n} 条`,
        });
      }
      void load();
    } catch (e) {
      setSyncStatus({
        kind: "fail",
        label: e instanceof Error ? e.message : "同步失败",
      });
    }
  };

  return (
    <>
      <h1 className="page-title">设置</h1>
      {error && <p className="empty">错误：{error}</p>}
      {saved && <p className="ok-note">已保存</p>}

      <div className="card" id="proxy-section">
        <h2 className="card-title">本地代理</h2>
        <p className="empty">
          监听地址固定为 <code>127.0.0.1:17800</code>（本地优先，无需修改）。
          全部预设供应商的代理地址请在<b>首页「快速接入」</b>中搜索并复制。
        </p>
        <p className="empty">
          例如使用 DeepSeek：
          <code>
            export OPENAI_BASE_URL="http://127.0.0.1:17800/api/proxy/deepseek"
          </code>
          。 你实际使用的客户端（Claude Code / Cursor / CC Switch / Trae
          等）即为“Agent”，记录会自动按工具识别。
        </p>
        <div className="form-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`btn ${proxy.enabled ? "primary" : ""}`}
            onClick={() => void toggleProxy()}
            disabled={proxyBusy}
          >
            {proxy.enabled ? "✓ 独立后台代理已开启" : "开启独立后台代理"}
          </button>
          <span className="empty" style={{ alignSelf: "center" }}>
            {proxy.enabled
              ? proxy.running
                ? "后台运行中 · 开机自启"
                : "已开启，等待运行…"
              : proxy.running
                ? "随应用运行中"
                : "未运行"}
          </span>
        </div>
        <p className="empty">
          开启后代理将<b>开机自启</b>，关闭应用也继续运行（AI
          工具无需常开应用）。 关闭开关后恢复「随应用运行」，应用退出即停止。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">外观主题</h2>
        <div className="form-row">
          <button
            type="button"
            className={`btn ${theme === "cosmos" ? "primary" : ""}`}
            onClick={() => setTheme("cosmos")}
          >
            深色 · Cosmos
          </button>
          <button
            type="button"
            className={`btn ${theme === "cozy" ? "primary" : ""}`}
            onClick={() => setTheme("cozy")}
          >
            浅色 · Cozy
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">悬浮卡片显示内容</h2>
        <p className="empty">
          悬浮统计卡片（顶栏「悬浮统计」按钮）上显示哪些数据，勾选即时生效。
        </p>
        <div className="form-row">
          {WIDGET_FIELDS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn ${widgetFields.includes(f.key) ? "primary" : ""}`}
              onClick={() => toggleWidgetField(f.key)}
              title={`悬浮卡片${widgetFields.includes(f.key) ? "显示" : "不显示"}「${f.label}」`}
            >
              {widgetFields.includes(f.key) ? "✓ " : ""}
              {f.label}
            </button>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => void saveSetting("widget_pos", "").catch(() => {})}
            title="清除保存的悬浮卡片位置，下次打开回到默认位置"
          >
            重置位置
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">模型定价（USD / 1M tokens）</h2>
        <div className="pricing-table">
          {pricing.map((p, i) => (
            <div key={i} className="pricing-row">
              <input
                className="input grow"
                value={p.model}
                onChange={(e) => setPrice(i, "model", e.target.value)}
                placeholder="模型名"
              />
              <input
                className="input"
                value={p.prompt}
                onChange={(e) => setPrice(i, "prompt", e.target.value)}
                placeholder="输入"
                title="每 1M 输入 tokens 价格 (USD)"
              />
              <input
                className="input"
                value={p.completion}
                onChange={(e) => setPrice(i, "completion", e.target.value)}
                placeholder="输出"
                title="每 1M 输出 tokens 价格 (USD)"
              />
              <button
                type="button"
                className="link-btn danger"
                onClick={() => removePrice(i)}
              >
                删
              </button>
            </div>
          ))}
        </div>
        <div className="form-row">
          <button type="button" className="btn" onClick={addPrice}>
            + 添加模型
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void fillDefaults()}
          >
            填入常见模型参考价
          </button>
          <button type="button" className="btn primary" onClick={savePricing}>
            保存定价
          </button>
        </div>
        <p className="empty">
          空表起步：未填定价的模型成本按 0
          计，不虚构。可一键填入常见模型参考价再保存。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">多设备同步</h2>
        {settings?.sync.account ? (
          <p className="empty">
            已登录账户：{settings.sync.account}
            {settings.sync.lastSync
              ? ` · 上次同步 ${settings.sync.lastSync}`
              : ""}
          </p>
        ) : (
          <div className="form-row">
            <input
              className="input grow"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="账户（云平台注册邮箱）"
            />
            <input
              className="input grow"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
            />
            <button
              type="button"
              className="btn primary"
              onClick={doLogin}
              disabled={syncBusy}
            >
              {syncStatus.kind === "busy" && syncStatus.action === "login"
                ? "登录中…"
                : "登录账户"}
            </button>
          </div>
        )}
        {settings?.sync.account && (
          <div className="form-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => doSync("upload")}
              disabled={syncBusy}
            >
              {syncStatus.kind === "busy" && syncStatus.action === "upload"
                ? "上传中…"
                : "上传到云"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => doSync("download")}
              disabled={syncBusy}
            >
              {syncStatus.kind === "busy" && syncStatus.action === "download"
                ? "下载中…"
                : "从云下载"}
            </button>
          </div>
        )}
        {syncStatus.kind === "busy" && (
          <p className="empty">{syncBusyLabel(syncStatus.action)}</p>
        )}
        {syncStatus.kind === "ok" && (
          <p className="ok-note">{syncStatus.label}</p>
        )}
        {syncStatus.kind === "fail" && (
          <p className="empty">{syncStatus.label}</p>
        )}
        {syncStatus.kind === "conflict" && (
          <p className="ok-note">{syncStatus.label}</p>
        )}
        <p className="empty">
          同步后本地账本与云端账户关联，多设备共用；按事件去重合并，隐私仅在你主动同步时上行。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">数据管理</h2>
        <div className="form-row">
          <button
            type="button"
            className="btn"
            style={
              confirming
                ? { background: "var(--ox-warn)", color: "#fff" }
                : undefined
            }
            onClick={doClearData}
            disabled={clearing}
          >
            {clearing
              ? "清除中…"
              : confirming
                ? "再次点击确认清除"
                : "清除本地数据"}
          </button>
        </div>
        <p className="empty">
          清空本地账本中的 Token 用量与成本统计（主题 / 定价 / 预算 /
          自定义供应商等设置会保留）。
        </p>
        {clearMsg && <p className="empty">{clearMsg}</p>}
      </div>

      <div className="card">
        <h2 className="card-title">关于</h2>
        <p className="empty">
          Oxelia51 桌面版 <b>v{appVersion}</b> · 本地优先的个人 Token 记账本 ·
          MIT 开源
        </p>
        <div className="about-links">
          <ExternalLink href={SITE_URL}>访问官网 oxelia51.com</ExternalLink>
          <ExternalLink href={`${SITE_URL}/download`}>下载页</ExternalLink>
          <ExternalLink href={`${GITHUB_URL}/issues`}>提交反馈</ExternalLink>
          <ExternalLink href={`${GITHUB_URL}/releases`}>
            GitHub Releases
          </ExternalLink>
          <ExternalLink href={`${GITHUB_URL}/blob/master/LICENSE`}>
            MIT 许可证
          </ExternalLink>
        </div>
        <p className="empty about-note">
          悬浮统计卡片可在顶栏「悬浮统计」按钮开关，实时显示今日 Token 与成本。
        </p>
      </div>
    </>
  );
}
