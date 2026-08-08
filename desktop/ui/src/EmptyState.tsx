/**
 * 全端统一空态（UI Polish §1.3）：伴星 glyph 弱化版 + 一句话说明 + 一个主按钮。
 * 禁止裸文字「暂无数据」。图标用 currentColor 内联 SVG，随主题自动适配。
 */
export function EmptyState({
  title,
  desc,
  action,
  compact = false,
}: {
  title: string;
  desc?: string;
  /** 主按钮：href 渲染为链接按钮，onClick 渲染为按钮。 */
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <svg className="empty-icon" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="6" />
        <circle cx="57" cy="57" r="4.5" fill="#E5484D" />
      </svg>
      <p className="empty-title">{title}</p>
      {desc && <p className="empty-desc">{desc}</p>}
      {action &&
        (action.href ? (
          <a className="btn primary empty-action" href={action.href} target="_blank" rel="noreferrer">
            {action.label}
          </a>
        ) : (
          <button type="button" className="btn primary empty-action" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
