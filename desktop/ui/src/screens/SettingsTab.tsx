import { useCallback, useEffect, useState } from "react";
import {
  cloudLogin,
  fetchPricing,
  fetchSettings,
  postSync,
  saveSetting,
  type PricedItem,
  type Settings,
} from "../api";

export function SettingsTab({ theme, onTheme, appVersion }: { theme: string; onTheme: (t: "cosmos" | "cozy") => void; appVersion: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pricing, setPricing] = useState<PricedItem[]>([]);
  const [port, setPort] = useState("17800");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([fetchSettings(), fetchPricing()]);
      setSettings(s);
      setPricing(p.pricing ?? []);
      setPort(String(s.port || 17800));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePort = async () => {
    const n = Number(port);
    if (!Number.isFinite(n) || n <= 0 || n > 65535) {
      setError("端口无效");
      return;
    }
    try {
      await saveSetting("port", String(n));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  const setTheme = async (t: "cosmos" | "cozy") => {
    onTheme(t);
    try {
      await saveSetting("theme", t);
    } catch {
      // ignore
    }
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
    setPricing((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: v } : p)));
  };

  const addPrice = () => {
    setPricing((prev) => [...prev, { model: "", prompt: "", completion: "" }]);
  };

  const removePrice = (i: number) => {
    setPricing((prev) => prev.filter((_, idx) => idx !== i));
  };

  // 登录云账户：拿 JWT 存进本地设置，之后 sidecar 用它做同步
  const doLogin = async () => {
    if (!account.trim() || !password) {
      setSyncMsg("请输入账户和密码");
      return;
    }
    setSyncing(true);
    setSyncMsg("登录中…");
    try {
      const token = await cloudLogin(account.trim(), password);
      await Promise.all([
        saveSetting("sync_token", token),
        saveSetting("sync_account", account.trim()),
      ]);
      setSyncMsg(`已登录 ${account.trim()}，可开始同步`);
      setPassword("");
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSyncing(false);
    }
  };

  const doSync = async (action: "upload" | "download") => {
    setSyncing(true);
    setSyncMsg(action === "upload" ? "上传中…" : "下载中…");
    try {
      const r = await postSync(action);
      setSyncMsg(
        action === "upload"
          ? `已上传 ${r.uploaded ?? 0} 条`
          : `已下载 ${r.downloaded ?? 0} 条`,
      );
      void load();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <h1 className="page-title">设置</h1>
      {error && <p className="empty">错误：{error}</p>}
      {saved && <p className="ok-note">已保存</p>}

      <div className="card">
        <h2 className="card-title">本地代理</h2>
        <div className="form-row">
          <input
            className="input"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="端口"
          />
          <button type="button" className="btn primary" onClick={savePort}>保存</button>
        </div>
        <p className="empty">当前监听 :{settings?.port ?? 17800}。修改后需重启应用生效。</p>
      </div>

      <div className="card">
        <h2 className="card-title">外观主题</h2>
        <div className="form-row">
          <button type="button" className={`btn ${theme === "cosmos" ? "primary" : ""}`} onClick={() => setTheme("cosmos")}>深色 · Cosmos</button>
          <button type="button" className={`btn ${theme === "cozy" ? "primary" : ""}`} onClick={() => setTheme("cozy")}>浅色 · Cozy</button>
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
              <button type="button" className="link-btn danger" onClick={() => removePrice(i)}>删</button>
            </div>
          ))}
        </div>
        <div className="form-row">
          <button type="button" className="btn" onClick={addPrice}>+ 添加模型</button>
          <button type="button" className="btn primary" onClick={savePricing}>保存定价</button>
        </div>
        <p className="empty">未列出的模型成本按 0 计，不虚构。</p>
      </div>

      <div className="card">
        <h2 className="card-title">多设备同步</h2>
        {settings?.sync.account ? (
          <p className="empty">已登录账户：{settings.sync.account}
            {settings.sync.lastSync ? ` · 上次同步 ${settings.sync.lastSync}` : ""}
          </p>
        ) : (
          <div className="form-row">
            <input className="input grow" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="账户（邮箱）" />
            <input className="input grow" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
            <button type="button" className="btn primary" onClick={doLogin} disabled={syncing}>
              {syncing ? "处理中…" : "登录账户"}
            </button>
          </div>
        )}
        {settings?.sync.account && (
          <div className="form-row">
            <button type="button" className="btn primary" onClick={() => doSync("upload")} disabled={syncing}>
              上传到云
            </button>
            <button type="button" className="btn" onClick={() => doSync("download")} disabled={syncing}>
              从云下载
            </button>
          </div>
        )}
        {syncMsg && <p className="ok-note">{syncMsg}</p>}
        <p className="empty">同步后本地账本与云端账户关联，多设备共用；按事件去重合并，隐私仅在你主动同步时上行。</p>
      </div>

      <div className="card">
        <h2 className="card-title">关于</h2>
        <p className="empty">Oxelia51 桌面版 v{appVersion} · 本地优先的个人 Token 记账本 · MIT 开源</p>
      </div>
    </>
  );
}
