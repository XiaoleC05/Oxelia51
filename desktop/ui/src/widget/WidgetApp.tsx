import { useEffect, useState } from "react";
import {
  fetchHealth,
  fetchOverview,
  fetchSettings,
  fmtCost,
  fmtTokens,
  type Overview,
} from "../api";

/** 悬浮卡片可显示的信息字段。 */
export const WIDGET_FIELDS: { key: string; label: string }[] = [
  { key: "tokens", label: "今日 Token" },
  { key: "cost", label: "今日成本" },
  { key: "requests", label: "请求数" },
  { key: "week", label: "近 7 日" },
];

/**
 * 悬浮透明玻璃卡片（桌面 widget）。
 * 固定在桌面上、始终置顶、跳过任务栏，实时轮询本地 sidecar 展示今日 Token / 成本。
 * 窗口配置见 tauri.conf.json 的 app.windows（label: "widget"）；
 * 主窗口顶栏「悬浮统计」按钮负责 show/hide（App.tsx）。
 * 显示哪些字段由「设置 → 悬浮卡片显示内容」控制（widgetFields，空 = 全部）。
 *
 * 数据源与主界面一致：/api/overview（今日 / 近7日 / 累计）。轮询间隔更短（2.5s）。
 * 透明窗口背景在 widget.css 里强制透明。
 */
export default function WidgetApp() {
  const [data, setData] = useState<Overview | null>(null);
  const [online, setOnline] = useState(false);
  // null = 设置还没加载（默认全显）；数组 = 用户勾选的字段
  const [fields, setFields] = useState<string[] | null>(null);

  // 读取本地设置：主题 + 悬浮卡片显示字段
  useEffect(() => {
    void fetchSettings()
      .then((s) => {
        if (s?.theme === "cosmos" || s?.theme === "cozy") {
          document.documentElement.dataset.theme = s.theme;
        }
        setFields(s.widgetFields?.length ? s.widgetFields : WIDGET_FIELDS.map((f) => f.key));
      })
      .catch(() => {});
  }, []);

  const show = (key: string) => fields === null || fields.includes(key);

  // 实时轮询：每 2.5s 刷新一次今日统计
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const [overview, health] = await Promise.all([
        fetchOverview().catch(() => null),
        fetchHealth(),
      ]);
      if (!alive) return;
      setData(overview);
      setOnline(health);
    };
    void tick();
    const timer = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // 关闭 = 隐藏窗口（右上角 ✕）
  const hide = () => {
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().hide();
      } catch {
        // 浏览器 dev 模式无窗口 API，忽略
      }
    })();
  };

  return (
    <div className="widget" data-tauri-drag-region="deep">
      <header className="widget-head" data-tauri-drag-region>
        <span className="widget-brand" data-tauri-drag-region>
          <span className="widget-dot" data-tauri-drag-region />
          <span className="widget-name" data-tauri-drag-region>
            oxelia51 · 实时统计
          </span>
        </span>
        <button type="button" className="widget-close" onClick={hide} title="隐藏悬浮卡片" aria-label="隐藏悬浮卡片">
          ✕
        </button>
      </header>

      {!online ? (
        <div className="widget-offline">
          <span className="widget-offline-dot" />
          代理离线
          <span className="widget-offline-sub">启动代理后自动刷新</span>
        </div>
      ) : (
        <>
          {show("tokens") && (
            <div className="widget-tokens tabular" data-tauri-drag-region>
              {fmtTokens(data?.today.tokens ?? 0)}
              <span className="widget-tokens-unit" data-tauri-drag-region>tokens</span>
            </div>
          )}
          {show("cost") && (
            <div className="widget-cost" data-tauri-drag-region>
              {fmtCost(data?.today.cost ?? 0)}
            </div>
          )}
          {(show("requests") || show("week")) && (
            <footer className="widget-foot" data-tauri-drag-region>
              {show("week") && (
                <span className="tabular">近 7 日 {fmtTokens(data?.week.tokens ?? 0)}</span>
              )}
              {show("requests") && (
                <span className="tabular">{data?.today.requests ?? 0} 次请求</span>
              )}
            </footer>
          )}
        </>
      )}
    </div>
  );
}
