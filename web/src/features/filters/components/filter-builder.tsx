import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { DatePicker } from "@/src/components/date-picker";
import {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Check, ChevronDown, FilterIcon, Info, Plus, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { MultiSelect } from "@/src/features/filters/components/multi-select";
import {
  type WipFilterState,
  type WipFilterCondition,
  type FilterState,
  type FilterCondition,
  type ColumnDefinition,
  filterOperators,
  singleFilter,
} from "@oxelia51/shared";
import { NonEmptyString } from "@oxelia51/shared";
import { cn } from "@/src/utils/tailwind";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import {
  InputCommand,
  InputCommandEmpty,
  InputCommandGroup,
  InputCommandInput,
  InputCommandItem,
  InputCommandList,
} from "@/src/components/ui/input-command";

/**
 * Extended ColumnDefinition with optional alert for UI display.
 * Alerts are added dynamically in the web layer based on feature availability.
 */
export type ColumnDefinitionWithAlert = ColumnDefinition & {
  alert?: {
    severity: "info" | "warning" | "error";
    content: React.ReactNode;
  };
};

// positionInTrace 过滤器只剩历史链接里可能出现（原生 sessions 已删）；
// 这里保留最小格式化/模式判定以兼容旧 URL，不再支持新建。
type PositionInTraceFilterMode =
  | "root"
  | "first"
  | "last"
  | "nthFromEnd"
  | "nthFromStart";

function getSessionPositionInTraceFilterMode(filter: {
  key?: string;
}): PositionInTraceFilterMode {
  const key = filter.key;
  return key === "first" ||
    key === "last" ||
    key === "nthFromEnd" ||
    key === "nthFromStart"
    ? key
    : "root";
}

function formatSessionPositionInTraceFilterValue(filter: {
  key?: string;
  value?: unknown;
}): string {
  const n = typeof filter.value === "number" ? filter.value : "?";
  switch (getSessionPositionInTraceFilterMode(filter)) {
    case "first":
      return "第 1 条";
    case "last":
      return "最后一条";
    case "nthFromStart":
      return `正数第 ${n} 条`;
    case "nthFromEnd":
      return `倒数第 ${n} 条`;
    default:
      return "根观测";
  }
}

// Has WipFilterState, passes all valid filters to parent onChange
export function PopoverFilterBuilder({
  columns,
  filterState,
  onChange,
  columnIdentifier = "name",
  columnsWithCustomSelect = [],
  buttonType = "default",
  label = "筛选",
  tableName = "unknown",
  isV4 = false,
}: {
  /** Which column field to persist in filter.column: 'id' for stable refs, 'name' for legacy compatibility */
  columns: ColumnDefinitionWithAlert[];
  filterState: FilterState;
  onChange:
    | Dispatch<SetStateAction<FilterState>>
    | ((newState: FilterState) => void);
  columnIdentifier?: ColumnIdentifier;
  columnsWithCustomSelect?: string[];
  buttonType?: "default" | "icon";
  /** Trigger button label. Defaults to "Filters"; override to clarify scope. */
  label?: string;
  /** Table this builder filters — the `tableName` analytics dimension. */
  tableName?: string;
  /** Whether this builder sits on a v4 (fast-mode) surface — `isV4` dimension. */
  isV4?: boolean;
}) {
  const capture = usePostHogClientCapture();
  const [wipFilterState, _setWipFilterState] =
    useState<WipFilterState>(filterState);
  // Count of already-applied (valid) filters, so `setWipFilterState` can emit
  // `filters:applied` only when a filter is newly completed — not on every
  // keystroke of an in-progress edit. Seeded from the incoming applied state.
  const prevValidCountRef = useRef(filterState.length);

  // Sync wipFilterState when filterState prop changes externally
  // (e.g., when a saved view preset is applied)
  // We use a ref to track previous filterState to avoid re-running when wipFilterState changes
  const prevFilterStateRef = useRef(filterState);
  useEffect(() => {
    // Only sync if filterState actually changed (reference comparison is fine here
    // since filterState comes from URL parsing which creates new arrays)
    if (prevFilterStateRef.current === filterState) return;
    prevFilterStateRef.current = filterState;

    _setWipFilterState((currentWip) => {
      const hasWipFilters = currentWip.some(
        (f) => !singleFilter.safeParse(f).success,
      );
      // Don't sync if user is actively editing (has invalid WIP filters)
      if (hasWipFilters) return currentWip;
      // Synced from external state (saved view applied, URL nav, clear-all): the
      // commit bypasses the wrapped `setWipFilterState`, so re-baseline the
      // applied-count ref here too (LFE-10781). Otherwise a stale count makes the
      // next wrapper edit — including popover close — mis-fire `filters:applied`.
      // `filterState` is already-valid (typed FilterState), so its length is the
      // valid count.
      prevValidCountRef.current = filterState.length;
      return filterState;
    });
  }, [filterState]);

  const addNewFilter = () => {
    setWipFilterState((prev) => [
      ...prev,
      {
        column: undefined,
        type: undefined,
        operator: undefined,
        value: undefined,
        key: undefined,
      },
    ]);
  };

  const getValidFilters = (state: WipFilterState): FilterCondition[] => {
    const valid = state.filter(
      (f) => singleFilter.safeParse(f).success,
    ) as FilterCondition[];
    return valid;
  };

  const setWipFilterState = (
    state: ((prev: WipFilterState) => WipFilterState) | WipFilterState,
  ) => {
    _setWipFilterState((prev) => {
      const newState = state instanceof Function ? state(prev) : state;
      const validFilters = getValidFilters(newState);
      onChange(validFilters);
      const prevCount = prevValidCountRef.current;
      // A row was actually removed (clear-all X → []; or a single row X). This
      // is the ONLY thing that counts as a clear: a valid count that drops
      // because a row went transiently invalid mid-edit (changing a row's column
      // sets value:undefined → fails safeParse) keeps the SAME row count and
      // must NOT emit `filters:cleared` — the user is refining, not clearing
      // (LFE-10781 review).
      const rowsRemoved = newState.length < prev.length;
      // Analytics (LFE-10781). METADATA ONLY — we report the changed filter's
      // shape + counts, never a raw value. Count semantics match the sidebar:
      // `conditionCount` = TOTAL applied conditions across ALL columns;
      // `columnConditionCount` = rows for the changed column.
      if (validFilters.length > prevCount) {
        // A filter was newly completed (valid count grew) — an in-progress edit
        // does not fire per keystroke.
        const applied = validFilters[validFilters.length - 1];
        if (applied) {
          capture("filters:applied", {
            surface: "filter_builder",
            tableName,
            column: applied.column,
            filterType: applied.type,
            operator: applied.operator,
            ...("key" in applied && applied.key ? { key: applied.key } : {}),
            valueCount: Array.isArray(applied.value) ? applied.value.length : 1,
            conditionCount: validFilters.length,
            columnConditionCount: validFilters.filter(
              (f) => f.column === applied.column,
            ).length,
            isV4,
          });
        }
      } else if (validFilters.length < prevCount && rowsRemoved) {
        // A real clear — the clear-all X buttons (setWipFilterState([])) or
        // removing a row. NOT a transient mid-column-change invalid shrink.
        capture("filters:cleared", {
          surface: "filter_builder",
          tableName,
          clearedCount: prevCount - validFilters.length,
          isV4,
        });
      }
      prevValidCountRef.current = validFilters.length;
      return newState;
    });
  };

  return (
    <div className="flex items-center">
      <Popover
        onOpenChange={(open) => {
          if (open) {
            capture("table:filter_builder_open");
          }
          // Create empty filter when opening popover
          if (open && filterState.length === 0) addNewFilter();
          // Discard all wip filters when closing popover
          if (!open) {
            // METADATA ONLY (LFE-10781): previously sent the full `filterState`,
            // which leaked raw filter VALUES (user ids, metadata content, free
            // text = PII) into PostHog. Send only the applied-filter count.
            capture("table:filter_builder_close", {
              filterCount: filterState.length,
            });
            setWipFilterState(filterState);
          }
        }}
      >
        <PopoverTrigger asChild>
          {buttonType === "default" ? (
            <Button variant="outline" type="button">
              <span>{label}</span>
              {filterState.length > 0 && filterState.length < 3 ? (
                <InlineFilterState
                  filterState={filterState}
                  className="hidden @6xl:block"
                />
              ) : null}
              {filterState.length > 0 ? (
                <span
                  className={cn(
                    "bg-input ml-1.5 rounded-sm px-1 text-xs shadow-xs @6xl:hidden",
                    filterState.length > 2 && "@6xl:inline",
                  )}
                >
                  {filterState.length}
                </span>
              ) : (
                <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
              )}
            </Button>
          ) : (
            <Button
              size="icon"
              type="button"
              variant="ghost"
              className="relative"
            >
              <FilterIcon className="h-4 w-4" />
              {filterState.length > 0 && (
                <span className="bg-input absolute top-0 -right-1 flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-xs shadow-xs">
                  {filterState.length}
                </span>
              )}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="w-fit max-w-[90vw] overflow-x-auto"
          align="start"
        >
          <FilterBuilderForm
            columnIdentifier={columnIdentifier}
            columns={columns}
            filterState={wipFilterState}
            onChange={setWipFilterState}
            columnsWithCustomSelect={columnsWithCustomSelect}
          />
        </PopoverContent>
      </Popover>
      {filterState.length > 0 ? (
        buttonType === "default" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setWipFilterState([])}
                variant="ghost"
                type="button"
                size="icon"
                className="ml-0.5"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>清除所有筛选</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setWipFilterState([])}
                variant="ghost"
                type="button"
                size="icon-xs"
                className="hover:bg-background ml-0.5"
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>清除所有筛选</TooltipContent>
          </Tooltip>
        )
      ) : null}
    </div>
  );
}

export function InlineFilterState({
  filterState,
  className,
}: {
  filterState: FilterState;
  className?: string;
}) {
  return filterState.map((filter, i) => {
    return (
      <span
        key={i}
        className={cn(
          "bg-input ml-2 rounded-md px-2 py-1 text-xs whitespace-nowrap",
          className,
        )}
      >
        {filter.column}
        {filter.type === "stringObject" ||
        filter.type === "numberObject" ||
        filter.type === "booleanObject"
          ? `.${filter.key}`
          : ""}{" "}
        {filter.operator}{" "}
        {filter.type === "positionInTrace"
          ? formatSessionPositionInTraceFilterValue(filter)
          : filter.type === "datetime"
            ? new Date(filter.value).toLocaleString()
            : filter.type === "stringOptions" || filter.type === "arrayOptions"
              ? filter.value.length > 2
                ? `已选择 ${filter.value.length}`
                : filter.value.join(", ")
              : filter.type === "number" || filter.type === "numberObject"
                ? filter.value
                : filter.type === "boolean" || filter.type === "booleanObject"
                  ? `${filter.value}`
                  : filter.type === "null"
                    ? ""
                    : `"${filter.value}"`}
      </span>
    );
  });
}

type ColumnIdentifier = "id" | "name";

export function InlineFilterBuilder({
  columns,
  filterState,
  onChange,
  columnIdentifier = "name",
  disabled,
  columnsWithCustomSelect,
}: {
  columns: ColumnDefinitionWithAlert[];
  filterState: FilterState;
  onChange:
    | Dispatch<SetStateAction<FilterState>>
    | ((newState: FilterState) => void);
  /** Which column field to persist in filter.column: 'id' for stable refs, 'name' for legacy compatibility */
  columnIdentifier?: ColumnIdentifier;
  disabled?: boolean;
  columnsWithCustomSelect?: string[];
}) {
  const [wipFilterState, _setWipFilterState] =
    useState<WipFilterState>(filterState);

  // Sync wipFilterState when filterState prop changes externally
  // (e.g., when a view changes resets filters or default filters are excluded)
  // We use a ref to track previous filterState to avoid re-running when wipFilterState changes
  const prevFilterStateRef = useRef(filterState);
  useEffect(() => {
    // Only sync if filterState actually changed (reference comparison is fine here
    // since filterState comes from parent state which creates new arrays on change)
    if (prevFilterStateRef.current === filterState) return;
    prevFilterStateRef.current = filterState;

    _setWipFilterState((currentWip) => {
      const hasWipFilters = currentWip.some(
        (f) => !singleFilter.safeParse(f).success,
      );
      // Don't sync if user is actively editing (has invalid WIP filters)
      return hasWipFilters ? currentWip : filterState;
    });
  }, [filterState]);

  const setWipFilterState = (
    state: ((prev: WipFilterState) => WipFilterState) | WipFilterState,
  ) => {
    _setWipFilterState((prev) => {
      const newState = state instanceof Function ? state(prev) : state;
      const validFilters = newState.filter(
        (f) => singleFilter.safeParse(f).success,
      ) as FilterState;
      onChange(validFilters);
      return newState;
    });
  };

  return (
    <div className="flex flex-col">
      <FilterBuilderForm
        columnIdentifier={columnIdentifier}
        columns={columns}
        filterState={wipFilterState}
        onChange={setWipFilterState}
        disabled={disabled}
        columnsWithCustomSelect={columnsWithCustomSelect}
      />
    </div>
  );
}

const getOperator = (
  type: NonNullable<WipFilterCondition["type"]>,
): WipFilterCondition["operator"] => {
  return filterOperators[type]?.length > 0
    ? filterOperators[type][0]
    : undefined;
};

/**
 * Returns severity-based styling classes for alert icons and tooltips
 */
const getAlertStyles = (severity: "info" | "warning" | "error") => {
  const styles = {
    error: {
      iconColor: "text-red-600",
      tooltipBg: "bg-red-50 dark:bg-red-950",
    },
    info: {
      iconColor: "text-blue-600",
      tooltipBg: "bg-blue-50 dark:bg-blue-950",
    },
    warning: {
      iconColor: "text-amber-600",
      tooltipBg: "bg-amber-50 dark:bg-amber-950",
    },
  };

  return styles[severity];
};

function FilterBuilderForm({
  columnIdentifier,
  columns,
  filterState,
  onChange,
  disabled,
  columnsWithCustomSelect = [],
}: {
  columnIdentifier: ColumnIdentifier;
  columns: ColumnDefinitionWithAlert[];
  filterState: WipFilterState;
  onChange: Dispatch<SetStateAction<WipFilterState>>;
  disabled?: boolean;
  columnsWithCustomSelect?: string[];
}) {
  const handleFilterChange = (filter: WipFilterCondition, i: number) => {
    onChange((prev) => {
      const newState = [...prev];
      newState[i] = filter;
      return newState;
    });
  };

  const addNewFilter = () => {
    onChange((prev) => [
      ...prev,
      {
        column: undefined,
        operator: undefined,
        value: undefined,
        type: undefined,
        key: undefined,
      },
    ]);
  };

  const removeFilter = (i: number) => {
    onChange((prev) => {
      const newState = [...prev];
      newState.splice(i, 1);
      return newState;
    });
  };

  return (
    <>
      <table className="table-auto">
        <tbody>
          {filterState.map((filter, i) => {
            const column = columns.find(
              (c) =>
                c.id === filter.column ||
                c.name === filter.column ||
                (filter.column !== undefined &&
                  c.aliases?.includes(filter.column)),
            );
            const keyOptions =
              column?.type === "numberObject" ||
              column?.type === "stringObject" ||
              column?.type === "booleanObject"
                ? column.keyOptions?.filter(
                    (o) => NonEmptyString.safeParse(o).success,
                  )
                : undefined;
            const columnLabel = column ? column.name : "列";
            return (
              <tr key={i}>
                <td className="p-1 text-sm">{i === 0 ? "当" : "且"}</td>
                <td className="flex gap-2 p-1">
                  {/* selector of the column to be filtered */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        type="button"
                        disabled={disabled}
                        className="flex w-full min-w-32 items-center justify-between gap-2"
                      >
                        <span className="truncate" title={columnLabel}>
                          {columnLabel}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="max-w-fit p-0"
                      onWheel={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchMove={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <InputCommand>
                        <InputCommandInput
                          placeholder="搜索列"
                          variant="bottom"
                        />
                        <InputCommandList>
                          <InputCommandEmpty>未找到选项。</InputCommandEmpty>
                          <InputCommandGroup>
                            {columns.map((option) => {
                              const hasAlert = !!option.alert;
                              const severity =
                                option.alert?.severity ?? "warning";
                              const alertStyles = getAlertStyles(severity);

                              return (
                                <InputCommandItem
                                  key={option.id}
                                  value={option.id}
                                  onSelect={(value) => {
                                    const col = columns.find(
                                      (c) => c.id === value,
                                    );
                                    const defaultOperator = col?.type
                                      ? getOperator(col.type)
                                      : undefined;

                                    handleFilterChange(
                                      {
                                        column: col?.[columnIdentifier],
                                        type: col?.type,
                                        operator: defaultOperator,
                                        value:
                                          col?.type === "null" ? "" : undefined,
                                        key:
                                          col?.type === "positionInTrace"
                                            ? "last"
                                            : undefined,
                                      } as WipFilterCondition,
                                      i,
                                    );
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      option.id === column?.id
                                        ? "visible"
                                        : "invisible",
                                    )}
                                  />
                                  <span className="flex-1">{option.name}</span>
                                  {hasAlert && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info
                                          className={cn(
                                            "ml-2 h-4 w-4",
                                            alertStyles.iconColor,
                                          )}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent
                                        className={cn(
                                          "max-w-xs",
                                          alertStyles.tooltipBg,
                                        )}
                                      >
                                        {option.alert?.content}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </InputCommandItem>
                              );
                            })}
                          </InputCommandGroup>
                        </InputCommandList>
                      </InputCommand>
                    </PopoverContent>
                  </Popover>
                  {filter.type &&
                  (filter.type === "numberObject" ||
                    filter.type === "stringObject" ||
                    filter.type === "booleanObject") &&
                  (column?.type === "numberObject" ||
                    column?.type === "stringObject" ||
                    column?.type === "booleanObject") ? (
                    keyOptions?.length ? (
                      // Case 1: object with keyOptions - selector of the key of the object
                      <Select
                        disabled={!filter.column}
                        onValueChange={(value) => {
                          handleFilterChange({ ...filter, key: value }, i);
                        }}
                        value={filter.key ?? ""}
                      >
                        <SelectTrigger className="min-w-[60px]">
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          {keyOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      // Case 2: object without keyOptions - text input
                      <Input
                        value={filter.key ?? ""}
                        placeholder="键"
                        disabled={disabled}
                        onChange={(e) =>
                          handleFilterChange(
                            { ...filter, key: e.target.value },
                            i,
                          )
                        }
                      />
                    )
                  ) : filter.type === "categoryOptions" &&
                    column?.type === "categoryOptions" ? (
                    // Case 3: categoryOptions
                    <Select
                      onValueChange={(value) => {
                        handleFilterChange({ ...filter, key: value }, i);
                      }}
                      value={filter.key ?? ""}
                    >
                      <SelectTrigger className="min-w-[60px]">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {column?.options.map((option) => (
                          <SelectItem key={option.label} value={option.label}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : filter.type === "positionInTrace" ? (
                    <Select
                      onValueChange={(value) => {
                        const needsValue =
                          value === "nthFromEnd" || value === "nthFromStart";
                        handleFilterChange(
                          {
                            ...filter,
                            key: value,
                            value: needsValue
                              ? typeof filter.value === "number" &&
                                filter.value >= 1
                                ? filter.value
                                : 1
                              : undefined,
                          } as WipFilterCondition,
                          i,
                        );
                      }}
                      value={getSessionPositionInTraceFilterMode(filter)}
                    >
                      <SelectTrigger className="min-w-[140px]">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">1st</SelectItem>
                        <SelectItem value="last">last</SelectItem>
                        <SelectItem value="nthFromStart">
                          nth from start
                        </SelectItem>
                        <SelectItem value="nthFromEnd">nth from end</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </td>
                <td className="p-1">
                  <Select
                    disabled={!filter.column || disabled}
                    onValueChange={(value) => {
                      // protect against invalid empty operator values
                      if (value === "") return;
                      handleFilterChange(
                        {
                          ...filter,
                          operator: value as any,
                          // Ensure null filters always have empty string value
                          value:
                            filter.type === "null" ? "" : (filter.value as any),
                        },
                        i,
                      );
                    }}
                    value={filter.operator ?? ""}
                  >
                    <SelectTrigger className="min-w-[60px]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.type !== undefined
                        ? filterOperators[filter.type].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  {filter.type === "string" ||
                  filter.type === "stringObject" ? (
                    <Input
                      disabled={disabled}
                      value={filter.value ?? ""}
                      placeholder="字符串"
                      onChange={(e) =>
                        handleFilterChange(
                          { ...filter, value: e.target.value },
                          i,
                        )
                      }
                    />
                  ) : filter.type === "number" ||
                    filter.type === "numberObject" ? (
                    <Input
                      value={filter.value ?? undefined}
                      disabled={disabled}
                      type="number"
                      step={(column?.type === "number" && column.step) || 0.01}
                      min={column?.type === "number" ? column.min : undefined}
                      placeholder="数字"
                      lang="en-US"
                      onChange={(e) =>
                        handleFilterChange(
                          {
                            ...filter,
                            value: isNaN(Number(e.target.value))
                              ? e.target.value
                              : Number(e.target.value),
                          },
                          i,
                        )
                      }
                    />
                  ) : filter.type === "datetime" ? (
                    <DatePicker
                      className="w-full"
                      disabled={disabled}
                      date={filter.value ? new Date(filter.value) : undefined}
                      onChange={(date) => {
                        handleFilterChange(
                          {
                            ...filter,
                            value: date,
                          },
                          i,
                        );
                      }}
                      includeTimePicker
                    />
                  ) : filter.type === "stringOptions" ||
                    filter.type === "arrayOptions" ? (
                    <MultiSelect
                      title="值"
                      className="min-w-[100px]"
                      options={
                        column?.type === filter.type ? column.options : []
                      }
                      onValueChange={(value) =>
                        handleFilterChange({ ...filter, value }, i)
                      }
                      values={Array.isArray(filter.value) ? filter.value : []}
                      disabled={disabled}
                      isCustomSelectEnabled={
                        column?.type === filter.type &&
                        columnsWithCustomSelect.includes(column.id)
                      }
                    />
                  ) : filter.type === "categoryOptions" &&
                    column?.type === "categoryOptions" ? (
                    <MultiSelect
                      title="值"
                      className="min-w-[100px]"
                      options={
                        column?.options
                          .find((o) => o.label === filter.key)
                          ?.values?.map((v) => ({ value: v })) ?? []
                      }
                      onValueChange={(value) =>
                        handleFilterChange({ ...filter, value }, i)
                      }
                      values={Array.isArray(filter.value) ? filter.value : []}
                      disabled={disabled}
                      isCustomSelectEnabled={
                        column?.type === filter.type &&
                        columnsWithCustomSelect.includes(column.id)
                      }
                    />
                  ) : filter.type === "boolean" ||
                    filter.type === "booleanObject" ? (
                    <Select
                      disabled={disabled}
                      onValueChange={(value) => {
                        handleFilterChange(
                          {
                            ...filter,
                            value: value !== "" ? value === "true" : undefined,
                          },
                          i,
                        );
                      }}
                      value={filter.value?.toString() ?? ""}
                    >
                      <SelectTrigger className="min-w-[60px]">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {["true", "false"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : filter.type === "positionInTrace" ? (
                    filter.key === "nthFromStart" ||
                    filter.key === "nthFromEnd" ? (
                      <Input
                        value={filter.value ?? ""}
                        disabled={disabled}
                        type="number"
                        min={1}
                        step={1}
                        onChange={(e) =>
                          handleFilterChange(
                            {
                              ...filter,
                              value: isNaN(Number(e.target.value))
                                ? undefined
                                : Math.max(1, Number(e.target.value)),
                            } as WipFilterCondition,
                            i,
                          )
                        }
                      />
                    ) : (
                      <Input disabled placeholder="-" />
                    )
                  ) : filter.type === "null" ? null : (
                    <Input disabled />
                  )}
                </td>
                <td>
                  <Button
                    onClick={() => removeFilter(i)}
                    variant="ghost"
                    type="button"
                    disabled={disabled}
                    size="xs"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!disabled ? (
        <Button
          onClick={() => addNewFilter()}
          type="button" // required as it will otherwise submit forms where this component is used
          className="mt-2"
          variant="outline"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          添加筛选
        </Button>
      ) : null}
    </>
  );
}
