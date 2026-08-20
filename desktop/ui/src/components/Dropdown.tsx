import { useEffect, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string };
export type DropdownGroup = { group: string; options: DropdownOption[] };

/**
 * 自定义下拉框（替代原生 <select>）。
 *
 * 原生 select 展开后的选项面板由系统/WebView 渲染成直角矩形，CSS 无法改圆角；
 * 这里用按钮触发器 + 自绘浮层实现，展开列表带圆角 / 边框 / 主题色 / 阴影，
 * 与整体风格一致（点击外部或 Esc 关闭）。
 */
export function Dropdown({
  value,
  groups,
  options,
  onChange,
  placeholder = "请选择…",
  ariaLabel,
  grow,
}: {
  value: string;
  groups?: DropdownGroup[];
  options?: DropdownOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** 与 .input.grow 一致：在 flex 行内拉伸占满 */
  grow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  const selected = list.find((o) => o.value === value);

  return (
    <div
      className={`dropdown ${grow ? "grow" : ""} ${open ? "open" : ""}`}
      ref={ref}
    >
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={selected?.label}
      >
        <span
          className={`dropdown-value ${selected ? "" : "dropdown-value-placeholder"}`}
        >
          {selected?.label ?? placeholder}
        </span>
      </button>
      {open && (
        <div className="dropdown-popup" role="listbox">
          {groups
            ? groups.map((g) => (
                <div key={g.group} className="dropdown-group">
                  <div className="dropdown-group-label">{g.group}</div>
                  {g.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={o.value === value}
                      className={`dropdown-item ${o.value === value ? "active" : ""}`}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ))
            : list.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`dropdown-item ${o.value === value ? "active" : ""}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}
