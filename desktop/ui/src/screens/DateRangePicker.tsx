/** 日期范围选项：全部 / 近7日 / 近30日 / 近90日。days=undefined 表示全部。 */
export const DATE_RANGES: { label: string; days?: number }[] = [
  { label: "全部" },
  { label: "近 7 日", days: 7 },
  { label: "近 30 日", days: 30 },
  { label: "近 90 日", days: 90 },
];

export function DateRangePicker({
  value,
  onChange,
}: {
  value?: number;
  onChange: (days?: number) => void;
}) {
  return (
    <div className="date-range-picker" role="tablist" aria-label="日期范围">
      {DATE_RANGES.map((r) => (
        <button
          key={r.label}
          type="button"
          role="tab"
          aria-selected={value === r.days}
          className={`range-chip ${value === r.days ? "active" : ""}`}
          onClick={() => onChange(r.days)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
