/**
 * Per-facet-type UIFilter builders extracted from useSidebarFilterState.
 * Each builder is a pure function mapping (facet + filterState + options) → UIFilter | null.
 * This separation makes each filter type independently testable while keeping
 * the main hook focused on state management.
 */

import type {
  FilterState,
  SingleValueOption,
  ColumnDefinition,
} from "@oxelia51/shared";
import { computeSelectedValues } from "../lib/filter-query-encoding";
import type {
  BooleanKeyValueFilterEntry,
  KeyValueFilterEntry,
  KeyedFilterKind,
  NumericKeyValueFilterEntry,
  StringKeyValueFilterEntry,
} from "../lib/sidebar-filter-actions";
import {
  type applyKeyedFilterEntries,
  clearCategoricalColumn,
} from "../lib/sidebar-filter-actions";
import type { FilterConfig } from "../lib/filter-config";

// ---- local type (mirrors useSidebarFilterState.KeyScoreLevels; cannot import due to circular dep) ----

type KeyScoreLevels = Record<string, ("observation" | "trace")[]>;

// ---- local helpers (extracted from useSidebarFilterState) ----

const EMPTY_MAP: Map<string, number> = new Map();

function computeNumericRange(
  column: string,
  filterState: FilterState,
  defaultMin: number,
  defaultMax: number,
): [number, number] {
  const minFilter = filterState.find(
    (f) => f.column === column && f.type === "number" && f.operator === ">=",
  );
  const maxFilter = filterState.find(
    (f) => f.column === column && f.type === "number" && f.operator === "<=",
  );
  const minValue =
    minFilter && typeof minFilter.value === "number"
      ? minFilter.value
      : defaultMin;
  const maxValue =
    maxFilter && typeof maxFilter.value === "number"
      ? maxFilter.value
      : defaultMax;
  return [minValue ?? defaultMin, maxValue ?? defaultMax];
}

function mergeUniqueStrings(...lists: (string[] | undefined)[]): string[] {
  return [
    ...new Set(lists.flat().filter((s): s is string => typeof s === "string")),
  ];
}

// The level-agnostic score facet columns whose name pickers carry ScoreTag
// level provenance (LFE-10596), each reading its OWN data-type-scoped level
// map — a name reused across types at different levels must not inherit the
// other type's level. Other keyValue facets (metadata) never carry levels.
const SCORE_LEVEL_TAGGED_COLUMNS: Readonly<Record<string, string>> = {
  scores_avg: "score_name_levels_numeric",
  score_categories: "score_name_levels_categorical",
  score_booleans: "score_name_levels_boolean",
};

function resolveKeyScoreLevels(
  column: string,
  options: Record<
    string,
    (string | SingleValueOption)[] | Record<string, string[]> | undefined
  >,
): KeyScoreLevels | undefined {
  const levelsKey = SCORE_LEVEL_TAGGED_COLUMNS[column];
  const scoreNameLevels = levelsKey ? options[levelsKey] : undefined;
  if (scoreNameLevels === undefined || Array.isArray(scoreNameLevels)) {
    return undefined;
  }
  const out: Record<string, ("observation" | "trace")[]> = {};
  for (const [name, levels] of Object.entries(scoreNameLevels)) {
    const valid = levels.filter(
      (level): level is "observation" | "trace" =>
        level === "observation" || level === "trace",
    );
    if (valid.length > 0) out[name] = valid;
  }
  return out;
}

function resolveKnownKeyOptions(
  facetKeyOptions: string[] | undefined,
  availableKeys:
    | (string | SingleValueOption)[]
    | Record<string, string[]>
    | undefined,
  activeKeys: string[],
): string[] {
  if (facetKeyOptions && facetKeyOptions.length > 0)
    return mergeUniqueStrings(facetKeyOptions, activeKeys);
  if (!Array.isArray(availableKeys)) return mergeUniqueStrings(activeKeys);
  const knownKeys = availableKeys.map((o) =>
    typeof o === "string" ? o : o.value,
  );
  return mergeUniqueStrings(knownKeys, activeKeys);
}

function mergeAvailableValuesWithActiveFilters(
  availableValues: Record<string, string[]>,
  activeFilters: { key: string; value: string[] }[],
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...availableValues };
  for (const filter of activeFilters) {
    merged[filter.key] = mergeUniqueStrings(merged[filter.key], filter.value);
  }
  return merged;
}

function processOptions(raw: (string | SingleValueOption)[]) {
  const values: string[] = [];
  const counts = new Map<string, number>();
  const displayByValue = new Map<string, string>();
  for (const opt of raw) {
    const v = typeof opt === "string" ? opt : opt.value;
    values.push(v);
    if (typeof opt !== "string") {
      if (opt.count !== undefined) counts.set(v, opt.count);
      if (opt.displayValue) displayByValue.set(v, opt.displayValue);
    }
  }
  return {
    values,
    counts: counts.size > 0 ? counts : EMPTY_MAP,
    displayByValue: displayByValue.size > 0 ? displayByValue : undefined,
  };
}

export type TextFilterEntry = {
  operator: "contains" | "does not contain";
  value: string;
};

// ---- context object passed to each builder ----

export interface FilterBuilderContext {
  filterState: FilterState;
  explicitFilterState: FilterState;
  options: Record<
    string,
    (string | SingleValueOption)[] | Record<string, string[]> | undefined
  >;
  expandedSet: Set<string>;
  columnDefinitions: ColumnDefinition[];
  managedEnvironmentColumn: string | undefined;
  hiddenEnvironments: string[];
  loadingColumns: ReadonlySet<string> | undefined;
  loading: boolean | undefined;
  // callbacks
  updateFilter: (column: string, values: string[]) => void;
  updateFilterOnly: (column: string, value: string) => void;
  updateOperator: (column: string, op: "any of" | "all of" | "none of") => void;
  updateNumericFilter: (
    column: string,
    value: [number, number] | null,
    dMin: number,
    dMax: number,
  ) => void;
  updateStringFilter: (column: string, value: string) => void;
  addTextFilter: (
    column: string,
    operator: "contains" | "does not contain",
    value: string,
  ) => void;
  removeTextFilter: (
    column: string,
    operator: "contains" | "does not contain",
    value: string,
  ) => void;
  updateKeyedFilter: (
    column: string,
    update: Parameters<typeof applyKeyedFilterEntries>[2],
  ) => void;
  resetKeyedFilter: (column: string, kind: KeyedFilterKind) => void;
  setFilterState: (state: FilterState) => void;
  emitFacetCleared: (column: string, removedCount: number) => void;
}

// ---- individual builders ----

export function buildNumericFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "numeric" }>,
  ctx: FilterBuilderContext,
) {
  const currentRange = computeNumericRange(
    facet.column,
    ctx.filterState,
    facet.min,
    facet.max,
  );
  const isActive = ctx.filterState.some(
    (f) => f.column === facet.column && f.type === "number",
  );
  const disableState = getFacetDisabledState(facet);
  return {
    type: "numeric" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: currentRange,
    min: facet.min,
    max: facet.max,
    unit: facet.unit,
    loading: false,
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (value: [number, number]) =>
      ctx.updateNumericFilter(facet.column, value, facet.min, facet.max),
    onReset: () =>
      ctx.updateNumericFilter(facet.column, null, facet.min, facet.max),
  };
}

export function buildStringFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "string" }>,
  ctx: FilterBuilderContext,
) {
  const filterByColumn = new Map(ctx.filterState.map((f) => [f.column, f]));
  const filterEntry = filterByColumn.get(facet.column);
  const currentValue =
    filterEntry?.type === "string" && typeof filterEntry.value === "string"
      ? filterEntry.value
      : "";
  const isActive = currentValue.trim() !== "";
  const disableState = getFacetDisabledState(facet);
  return {
    type: "string" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: currentValue,
    loading: false,
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (value: string) => ctx.updateStringFilter(facet.column, value),
    onReset: () => ctx.updateStringFilter(facet.column, ""),
  };
}

export function buildKeyValueFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "keyValue" }>,
  ctx: FilterBuilderContext,
) {
  const categoryFilters = ctx.filterState.filter(
    (f) => f.column === facet.column && f.type === "categoryOptions",
  ) as Array<{
    column: string;
    type: "categoryOptions";
    operator: "any of" | "none of";
    key: string;
    value: string[];
  }>;
  const activeFilters: KeyValueFilterEntry[] = categoryFilters.map((f) => ({
    key: f.key,
    operator: f.operator,
    value: f.value,
  }));
  const isActive = activeFilters.length > 0;
  const disableState = getFacetDisabledState(facet);
  const availableValues = ctx.options[facet.column] ?? {};
  const mergedAvailableValues =
    typeof availableValues === "object" && !Array.isArray(availableValues)
      ? mergeAvailableValuesWithActiveFilters(
          availableValues as Record<string, string[]>,
          activeFilters,
        )
      : ({} as Record<string, string[]>);
  const keyOptions =
    facet.keyOptions ??
    mergeUniqueStrings(
      Object.keys(mergedAvailableValues),
      activeFilters.map((f) => f.key),
    );
  return {
    type: "keyValue" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: activeFilters,
    keyOptions,
    keyLevels: resolveKeyScoreLevels(facet.column, ctx.options),
    availableValues: mergedAvailableValues,
    loading: shouldShowLoading(facet.column, ctx),
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (filters: KeyValueFilterEntry[]) =>
      ctx.updateKeyedFilter(facet.column, {
        kind: "categoryOptions",
        entries: filters,
      }),
    onReset: () => ctx.resetKeyedFilter(facet.column, "categoryOptions"),
  };
}

export function buildNumericKeyValueFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "numericKeyValue" }>,
  ctx: FilterBuilderContext,
) {
  const numericFilters = ctx.filterState.filter(
    (f) => f.column === facet.column && f.type === "numberObject",
  ) as Array<{
    column: string;
    type: "numberObject";
    operator: "=" | ">" | "<" | ">=" | "<=";
    key: string;
    value: number;
  }>;
  const activeFilters: NumericKeyValueFilterEntry[] = numericFilters.map(
    (f) => ({ key: f.key, operator: f.operator, value: f.value }),
  );
  const isActive = activeFilters.length > 0;
  const disableState = getFacetDisabledState(facet);
  const pairedBooleanKeys =
    ctx.options[facet.column.replace(/scores_avg$/, "score_booleans")];
  const booleanNames = new Set(
    Array.isArray(pairedBooleanKeys)
      ? pairedBooleanKeys.map((o) => (typeof o === "string" ? o : o.value))
      : [],
  );
  const availableKeys = ctx.options[facet.column];
  const nonBooleanKeys =
    Array.isArray(availableKeys) && booleanNames.size > 0
      ? availableKeys.filter(
          (o) => !booleanNames.has(typeof o === "string" ? o : o.value),
        )
      : availableKeys;
  const keyOptions = resolveKnownKeyOptions(
    facet.keyOptions,
    nonBooleanKeys,
    activeFilters.map((f) => f.key),
  );
  return {
    type: "numericKeyValue" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: activeFilters,
    keyOptions,
    keyLevels: resolveKeyScoreLevels(facet.column, ctx.options),
    loading: shouldShowLoading(facet.column, ctx),
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (filters: NumericKeyValueFilterEntry[]) =>
      ctx.updateKeyedFilter(facet.column, {
        kind: "numberObject",
        entries: filters,
      }),
    onReset: () => ctx.resetKeyedFilter(facet.column, "numberObject"),
  };
}

export function buildBooleanKeyValueFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "booleanKeyValue" }>,
  ctx: FilterBuilderContext,
) {
  const booleanFilters = ctx.filterState.filter(
    (f) => f.column === facet.column && f.type === "booleanObject",
  ) as Array<{
    column: string;
    type: "booleanObject";
    operator: "=" | "<>";
    key: string;
    value: boolean;
  }>;
  const activeFilters: BooleanKeyValueFilterEntry[] = booleanFilters.map(
    (f) => ({ key: f.key, operator: f.operator, value: f.value }),
  );
  const isActive = activeFilters.length > 0;
  const disableState = getFacetDisabledState(facet);
  const availableKeys = ctx.options[facet.column];
  const keyOptions = resolveKnownKeyOptions(
    facet.keyOptions,
    availableKeys,
    activeFilters.map((f) => f.key),
  );
  return {
    type: "booleanKeyValue" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: activeFilters,
    keyOptions,
    keyLevels: resolveKeyScoreLevels(facet.column, ctx.options),
    loading: shouldShowLoading(facet.column, ctx),
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (filters: BooleanKeyValueFilterEntry[]) =>
      ctx.updateKeyedFilter(facet.column, {
        kind: "booleanObject",
        entries: filters,
      }),
    onReset: () => ctx.resetKeyedFilter(facet.column, "booleanObject"),
  };
}

export function buildStringKeyValueFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "stringKeyValue" }>,
  ctx: FilterBuilderContext,
) {
  const stringFilters = ctx.filterState.filter(
    (f) => f.column === facet.column && f.type === "stringObject",
  ) as Array<{
    column: string;
    type: "stringObject";
    operator: "=" | "contains" | "does not contain";
    key: string;
    value: string;
  }>;
  const activeFilters: StringKeyValueFilterEntry[] = stringFilters.map((f) => ({
    key: f.key,
    operator: f.operator,
    value: f.value,
  }));
  const isActive = activeFilters.length > 0;
  const disableState = getFacetDisabledState(facet);
  const availableKeys = ctx.options[facet.column];
  const keyOptions = resolveKnownKeyOptions(
    facet.keyOptions,
    availableKeys,
    activeFilters.map((f) => f.key),
  );
  return {
    type: "stringKeyValue" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: activeFilters,
    keyOptions,
    loading: shouldShowLoading(facet.column, ctx),
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (filters: StringKeyValueFilterEntry[]) =>
      ctx.updateKeyedFilter(facet.column, {
        kind: "stringObject",
        entries: filters,
      }),
    onReset: () => ctx.resetKeyedFilter(facet.column, "stringObject"),
  };
}

export function buildBooleanFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "boolean" }>,
  ctx: FilterBuilderContext,
) {
  const filterByColumn = new Map(ctx.filterState.map((f) => [f.column, f]));
  const trueLabel = facet.trueLabel ?? "True";
  const falseLabel = facet.falseLabel ?? "False";
  const invert = facet.invertValue ?? false;
  const availableOptions = [trueLabel, falseLabel];
  const filterEntry = filterByColumn.get(facet.column);
  let selectedOptions = availableOptions;
  if (filterEntry) {
    const boolValue = filterEntry.value as boolean;
    selectedOptions = invert
      ? boolValue === true
        ? [falseLabel]
        : [trueLabel]
      : boolValue === true
        ? [trueLabel]
        : [falseLabel];
  }
  const isActive = selectedOptions.length === 1;
  const disableState = getFacetDisabledState(facet);
  const rawOptions = ctx.options[facet.column];
  let counts: Map<string, number> = EMPTY_MAP;
  if (Array.isArray(rawOptions) && rawOptions.length > 0) {
    const { counts: processedCounts } = processOptions(rawOptions);
    if (processedCounts.size > 0) {
      counts = new Map<string, number>();
      if (invert) {
        const falseCount = processedCounts.get("false") ?? 0;
        const trueCount = processedCounts.get("true") ?? 0;
        if (falseCount > 0) counts.set(trueLabel, falseCount);
        if (trueCount > 0) counts.set(falseLabel, trueCount);
      } else {
        const trueCount = processedCounts.get("true") ?? 0;
        const falseCount = processedCounts.get("false") ?? 0;
        if (trueCount > 0) counts.set(trueLabel, trueCount);
        if (falseCount > 0) counts.set(falseLabel, falseCount);
      }
    }
  }
  return {
    type: "categorical" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: selectedOptions,
    options: availableOptions,
    counts,
    loading: shouldShowLoading(facet.column, ctx),
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    onChange: (values: string[]) => {
      if (values.length === 0 || values.length === 2) {
        ctx.updateFilter(facet.column, []);
        return;
      }
      if (values.includes(trueLabel) && !values.includes(falseLabel))
        ctx.updateFilter(facet.column, [trueLabel]);
      else if (values.includes(falseLabel) && !values.includes(trueLabel))
        ctx.updateFilter(facet.column, [falseLabel]);
    },
    onOnlyChange: (value: string) => {
      if (selectedOptions.length === 1 && selectedOptions.includes(value))
        ctx.updateFilter(facet.column, []);
      else ctx.updateFilter(facet.column, [value]);
    },
    onReset: () => ctx.updateFilter(facet.column, []),
  };
}

export function buildCategoricalFilter(
  facet: Extract<FilterConfig["facets"][number], { type: "categorical" }>,
  ctx: FilterBuilderContext,
) {
  const availableValuesRaw = ctx.options[facet.column] ?? [];
  const availableValuesWithOptions = Array.isArray(availableValuesRaw)
    ? availableValuesRaw
    : [];
  const {
    values: availableValues,
    counts,
    displayByValue,
  } = Array.isArray(availableValuesWithOptions)
    ? processOptions(availableValuesWithOptions)
    : {
        values: [] as string[],
        counts: EMPTY_MAP,
        displayByValue: undefined as Map<string, string> | undefined,
      };
  const colDef = ctx.columnDefinitions.find((c) => c.id === facet.column);
  const isArrayOptions = colDef?.type === "arrayOptions";
  const textFilterDisabled =
    facet.type === "categorical" && facet.disableTextFilter === true;
  const checkboxFilter = ctx.filterState.find(
    (f) =>
      f.column === facet.column &&
      (f.type === "stringOptions" || f.type === "arrayOptions"),
  );
  const selectedValues = computeSelectedValues(availableValues, checkboxFilter);
  let currentOperator: "any of" | "all of" | "none of" | undefined;
  if (
    checkboxFilter &&
    (checkboxFilter.type === "arrayOptions" ||
      checkboxFilter.type === "stringOptions") &&
    (checkboxFilter.operator === "any of" ||
      checkboxFilter.operator === "all of" ||
      checkboxFilter.operator === "none of")
  ) {
    currentOperator = checkboxFilter.operator;
  } else if (isArrayOptions && selectedValues.length > 0) {
    currentOperator = "any of";
  }
  const textFilters: TextFilterEntry[] = ctx.filterState
    .filter(
      (f): f is Extract<typeof f, { type: "string" }> =>
        f.column === facet.column &&
        f.type === "string" &&
        (f.operator === "contains" || f.operator === "does not contain"),
    )
    .map((f) => ({
      operator: f.operator as "contains" | "does not contain",
      value: f.value,
    }));
  const hasTextFilters = textFilters.length > 0;
  const hasExplicitCheckboxFilter =
    !!checkboxFilter &&
    Array.isArray(checkboxFilter.value) &&
    checkboxFilter.value.length > 0;
  const hasExplicitCheckboxFilterWhileLoading =
    hasExplicitCheckboxFilter &&
    selectedValues.length === 0 &&
    availableValues.length === 0;
  const hasCheckboxSelections =
    selectedValues.length > 0 &&
    selectedValues.length !== availableValues.length;
  const isManagedEnvironmentFacet =
    facet.column === ctx.managedEnvironmentColumn &&
    ctx.hiddenEnvironments.length > 0;
  const hasExplicitManagedEnvironmentFilter =
    isManagedEnvironmentFacet &&
    ctx.explicitFilterState.some(
      (f) => f.column === ctx.managedEnvironmentColumn,
    );
  const isActive =
    hasTextFilters ||
    (isManagedEnvironmentFacet
      ? hasExplicitManagedEnvironmentFilter
      : (currentOperator === "all of" &&
          (selectedValues.length === availableValues.length ||
            hasExplicitCheckboxFilterWhileLoading)) ||
        (currentOperator === "none of" && hasExplicitCheckboxFilter) ||
        hasCheckboxSelections ||
        hasExplicitCheckboxFilterWhileLoading);
  const disableState = getFacetDisabledState(facet);
  return {
    type: "categorical" as const,
    column: facet.column,
    label: facet.label,
    tooltip: facet.tooltip,
    help: facet.help,
    value: selectedValues,
    options: availableValues,
    counts,
    displayByValue,
    loading: shouldShowLoading(facet.column, ctx),
    expanded: ctx.expandedSet.has(facet.column),
    isActive,
    isDisabled: disableState.isDisabled,
    disabledReason: disableState.reason,
    renderIcon: facet.type === "categorical" ? facet.renderIcon : undefined,
    onChange: (values: string[]) => ctx.updateFilter(facet.column, values),
    onOnlyChange: (value: string) => {
      if (selectedValues.length === 1 && selectedValues.includes(value))
        ctx.updateFilter(facet.column, availableValues);
      else ctx.updateFilterOnly(facet.column, value);
    },
    onReset: () => {
      const next = clearCategoricalColumn(ctx.filterState, facet.column);
      ctx.setFilterState(next);
      if (next.length < ctx.filterState.length)
        ctx.emitFacetCleared(
          facet.column,
          ctx.filterState.length - next.length,
        );
    },
    operator: currentOperator,
    excludedValues:
      checkboxFilter?.operator === "none of" &&
      Array.isArray(checkboxFilter.value)
        ? (checkboxFilter.value as string[])
        : undefined,
    onOperatorChange: isArrayOptions
      ? (op: "any of" | "all of" | "none of") =>
          ctx.updateOperator(facet.column, op)
      : undefined,
    textFilters:
      !isArrayOptions && !textFilterDisabled ? textFilters : undefined,
    onTextFilterAdd:
      !isArrayOptions && !textFilterDisabled
        ? (op: "contains" | "does not contain", val: string) =>
            ctx.addTextFilter(facet.column, op, val)
        : undefined,
    onTextFilterRemove:
      !isArrayOptions && !textFilterDisabled
        ? (op: "contains" | "does not contain", val: string) =>
            ctx.removeTextFilter(facet.column, op, val)
        : undefined,
  };
}

// ---- shared helpers ----

function shouldShowLoading(
  facetColumn: string,
  ctx: Pick<FilterBuilderContext, "loadingColumns" | "loading" | "options">,
): boolean {
  if (ctx.loadingColumns) return ctx.loadingColumns.has(facetColumn);
  if (!ctx.loading) return false;
  return ctx.options[facetColumn] === undefined;
}

function getFacetDisabledState(facet: FilterConfig["facets"][number]): {
  isDisabled: boolean;
  reason?: string;
} {
  const staticDisabled = facet.isDisabled ?? false;
  if (staticDisabled)
    return {
      isDisabled: true,
      reason: facet.disabledReason ?? "This filter is currently disabled.",
    };
  return { isDisabled: false };
}
