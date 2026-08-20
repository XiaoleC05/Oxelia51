import type React from "react";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  StringParam,
  useQueryParam,
  type UrlUpdateType,
} from "use-query-params";
import {
  type FilterState,
  singleFilter,
  type SingleValueOption,
  type ColumnDefinition,
} from "@oxelia51/shared";
import {
  encodeFiltersGeneric,
  decodeFiltersGeneric,
  MAX_URL_FILTER_QUERY_LENGTH,
} from "../lib/filter-query-encoding";
import {
  buildSidebarFilterQueryStorageKey,
  createPersistedSidebarFilterQueryState,
  getPersistedSidebarFilterQueryForContext,
  type PersistedSidebarFilterQueryState,
} from "../lib/persistedSidebarFilterQuery";
import { normalizeFilterColumnNames } from "../lib/filter-transform";
import {
  buildEffectiveEnvironmentFilter,
  buildManagedEnvironmentPolicyConfig,
  stripImplicitEnvironmentFilterFromExplicitState,
  type ManagedEnvironmentPolicyInput,
} from "../lib/managedEnvironmentPolicy";
import { useKeyedSessionStorageState } from "./useKeyedSessionStorageState";
import useSessionStorage from "@/src/components/useSessionStorage";
import type { FilterConfig, FilterStateMigration } from "../lib/filter-config";
import {
  addTextFilterEntry,
  applyCheckboxSelection,
  applyKeyedFilterEntries,
  applyNumericRange,
  applyStringContains,
  buildOnlySelection,
  deriveOperatorChange,
  removeColumnFiltersOfType,
  removeTextFilterEntry,
  type BooleanKeyValueFilterEntry,
  type KeyValueFilterEntry,
  type KeyedFilterKind,
  type NumericKeyValueFilterEntry,
  type SidebarFilterActionContext,
  type StringKeyValueFilterEntry,
} from "../lib/sidebar-filter-actions";

// Re-exported so existing consumers (tests, session view) keep their path.
export { resolveCheckboxOperator } from "../lib/sidebar-filter-actions";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import {
  buildNumericFilter,
  buildStringFilter,
  buildKeyValueFilter,
  buildNumericKeyValueFilter,
  buildBooleanKeyValueFilter,
  buildStringKeyValueFilter,
  buildBooleanFilter,
  buildCategoricalFilter,
  type FilterBuilderContext,
  type TextFilterEntry,
} from "./sidebar-filter-builders";

// Re-exported for external consumers (e.g. data-table-controls.tsx).
export type { TextFilterEntry };

/**
 * Decodes filters from URL query string and normalizes display names to column IDs.
 * This prevents duplicates when old URLs use display names and new filters use column IDs.
 *
 * @param filtersQuery - Encoded filter string from URL
 * @param columnDefinitions - Column definitions for validation and normalization
 * @returns Normalized and validated FilterState
 */
export function decodeAndNormalizeFilters(
  filtersQuery: string,
  columnDefinitions: ColumnDefinition[],
  migrateFilterState?: FilterStateMigration,
): FilterState {
  try {
    const filters = decodeFiltersGeneric(filtersQuery);
    const knownColumns = new Map<string, string>();
    for (const columnDefinition of columnDefinitions) {
      knownColumns.set(columnDefinition.id, columnDefinition.id);
      knownColumns.set(columnDefinition.name, columnDefinition.id);
      // Map old column IDs to current canonical ID for backward compat
      for (const alias of columnDefinition.aliases ?? []) {
        knownColumns.set(alias, columnDefinition.id);
      }
    }

    // Normalize display names to column IDs immediately after decoding
    // This prevents duplicates when old URLs use display names (e.g., "Environment")
    // and user adds new filters with column IDs (e.g., "environment")
    const normalized = normalizeFilterColumnNames(filters, columnDefinitions);
    const migrated = migrateFilterState
      ? migrateFilterState(normalized)
      : normalized;

    // Validate normalized filters
    const result: FilterState = [];
    for (const filter of migrated) {
      const validationResult = singleFilter.safeParse(filter);
      if (validationResult.success) {
        const canonicalColumnId = knownColumns.get(
          validationResult.data.column,
        );
        if (!canonicalColumnId) {
          // Gracefully ignore stale filters from old URLs or saved state.
          continue;
        }

        result.push({
          ...validationResult.data,
          column: canonicalColumnId,
        });
      } else {
        console.warn(`Invalid filter skipped:`, filter, validationResult.error);
      }
    }
    return result;
  } catch (error) {
    console.error("Error decoding filters:", error);
    return [];
  }
}

export interface BaseUIFilter {
  column: string;
  label: string;
  tooltip?: string;
  help?: {
    description: React.ReactNode;
    href?: string;
  };
  loading: boolean;
  expanded: boolean;
  isActive: boolean;
  isDisabled: boolean;
  disabledReason?: string;
  onReset: () => void;
}

export interface CategoricalUIFilter extends BaseUIFilter {
  type: "categorical";
  value: string[];
  options: string[];
  counts: Map<string, number>;
  displayByValue?: Map<string, string>;
  onChange: (values: string[]) => void;
  onOnlyChange?: (value: string) => void;
  /** Optional function to render an icon next to filter option labels */
  renderIcon?: (value: string) => React.ReactNode;
  /**
   * Current operator of the facet's checkbox filter (arrayOptions AND
   * stringOptions columns; undefined when no filter is applied):
   * - "any of": OR logic - match if item has ANY selected value
   * - "all of": AND logic - match if item has ALL selected values (arrayOptions only)
   * - "none of": exclude items carrying an UNCHECKED value (the filter stores
   *   the exclusions; checkboxes display the kept complement)
   */
  operator?: "any of" | "all of" | "none of";
  /**
   * Raw stored exclusions of an active "none of" filter, INCLUDING carried
   * exclusions outside the current (time-scoped, top-N-capped) option list
   * that the checked=kept checkbox display cannot show (LFE-10717).
   * Display-only — lets the facet header summary report the whole filter
   * instead of just its visible part.
   */
  excludedValues?: string[];
  /**
   * Callback to change the operator. Only provided for arrayOptions columns.
   * When called, updates the filter to use the specified operator.
   */
  onOperatorChange?: (operator: "any of" | "all of" | "none of") => void;
  /**
   * Active text filters (contains/does not contain) for this column
   * Mutually exclusive with checkbox selections
   */
  textFilters?: TextFilterEntry[];
  // Add a new text filter. Automatically clears checkbox selections.
  onTextFilterAdd?: (
    operator: "contains" | "does not contain",
    value: string,
  ) => void;
  // Remove a text filter by operator and value
  onTextFilterRemove?: (
    operator: "contains" | "does not contain",
    value: string,
  ) => void;
}

export interface NumericUIFilter extends BaseUIFilter {
  type: "numeric";
  value: [number, number];
  min: number;
  max: number;
  onChange: (value: [number, number]) => void;
  unit?: string;
}

export interface StringUIFilter extends BaseUIFilter {
  type: "string";
  value: string;
  onChange: (value: string) => void;
}

/**
 * Score-name → the level(s) it exists at, for tagging each offered name with
 * a ScoreTag (LFE-10596). Only present on the level-agnostic score facets
 * (`scores_avg` / `score_categories` / `score_booleans`), fed by the
 * filter-options `score_name_levels` payload.
 */
export type KeyScoreLevels = Record<
  string,
  readonly ("observation" | "trace")[]
>;

// The keyed-facet row shapes live beside the pure state transitions in
// sidebar-filter-actions; re-exported here so existing consumers keep their
// import path.
export type {
  KeyValueFilterEntry,
  NumericKeyValueFilterEntry,
  BooleanKeyValueFilterEntry,
  StringKeyValueFilterEntry,
} from "../lib/sidebar-filter-actions";

export interface KeyValueUIFilter extends BaseUIFilter {
  type: "keyValue";
  value: KeyValueFilterEntry[]; // Array of active filter rows
  keyOptions?: string[];
  keyLevels?: KeyScoreLevels;
  availableValues: Record<string, string[]>;
  onChange: (filters: KeyValueFilterEntry[]) => void;
}

export interface NumericKeyValueUIFilter extends BaseUIFilter {
  type: "numericKeyValue";
  value: NumericKeyValueFilterEntry[]; // Array of active filter rows
  keyOptions?: string[];
  keyLevels?: KeyScoreLevels;
  onChange: (filters: NumericKeyValueFilterEntry[]) => void;
}

export interface BooleanKeyValueUIFilter extends BaseUIFilter {
  type: "booleanKeyValue";
  value: BooleanKeyValueFilterEntry[]; // Array of active filter rows
  keyOptions?: string[];
  keyLevels?: KeyScoreLevels;
  onChange: (filters: BooleanKeyValueFilterEntry[]) => void;
}

export interface StringKeyValueUIFilter extends BaseUIFilter {
  type: "stringKeyValue";
  value: StringKeyValueFilterEntry[]; // Array of active filter rows
  keyOptions?: string[];
  onChange: (filters: StringKeyValueFilterEntry[]) => void;
}

export type UIFilter =
  | CategoricalUIFilter
  | NumericUIFilter
  | StringUIFilter
  | KeyValueUIFilter
  | NumericKeyValueUIFilter
  | BooleanKeyValueUIFilter
  | StringKeyValueUIFilter;

type UpdateFilter = (
  column: string,
  values: string[],
  operator?: "any of" | "none of" | "all of",
) => void;

type BaseUseSidebarFilterStateOptions = {
  loading?: boolean;
  implicitDefaultConfig?: ManagedEnvironmentPolicyInput;
  /** Explicit defaults are visible/editable but are not persisted until the user edits. */
  defaultExplicitFilterState?: FilterState;
  onExplicitFilterStateChange?: (params: {
    previousFilters: FilterState;
    nextFilters: FilterState;
    origin: "user" | "saved_view" | "system";
  }) => void;
  /**
   * Precise per-facet loading set (lazy filter-options): exactly the columns
   * whose options have been requested but not yet arrived. When provided it
   * drives the facet skeleton instead of the coarse `loading` flag, so a facet
   * shows a skeleton only while its own options stream in — and never for
   * columns that are not server-enumerated (e.g. metadata).
   */
  loadingColumns?: ReadonlySet<string>;
  /**
   * Whether this sidebar is rendered on a v4 (fast-mode / events-table) surface.
   * Drives the `isV4` dimension on the `filters:*` analytics events so we can
   * split filtering behaviour by v3-legacy vs v4-fast-mode. Defaults to false;
   * the v4 events table passes `true`.
   */
  isV4?: boolean;
};

export type UseSidebarFilterStateOptions =
  | (BaseUseSidebarFilterStateOptions & {
      stateLocation: "urlAndSessionStorage";
      /**
       * Optional context identifier (for example projectId) to guard against
       * carrying persisted filters across contexts.
       */
      sessionFilterContextId?: string | null;
    })
  | (BaseUseSidebarFilterStateOptions & { stateLocation: "url" })
  | (BaseUseSidebarFilterStateOptions & { stateLocation: "memory" });

const DEFAULT_HOOK_OPTIONS: UseSidebarFilterStateOptions = {
  stateLocation: "urlAndSessionStorage",
};

// The URL value a given serialized filter query should produce: oversized
// queries stay out of the URL entirely — the full request head is capped at
// ~16KB by Node and most proxies, so a giant `?filter=` 431s on the next full
// request (LFE-10717). Callers fall back to the session-storage mirror, which
// keeps same-tab refreshes working. Only used where that fallback exists
// (stateLocation "urlAndSessionStorage").
const toUrlFilterQuery = (encoded: string): string =>
  encoded.length > MAX_URL_FILTER_QUERY_LENGTH ? "" : encoded;

export function useSidebarFilterState(
  config: FilterConfig,
  options: Record<
    string,
    (string | SingleValueOption)[] | Record<string, string[]> | undefined
  >,
  hookOptions: UseSidebarFilterStateOptions = DEFAULT_HOOK_OPTIONS,
) {
  const {
    loading,
    loadingColumns,
    implicitDefaultConfig,
    onExplicitFilterStateChange,
  } = hookOptions;
  const isV4Surface = hookOptions.isV4 ?? false;
  const capture = usePostHogClientCapture();
  const stateLocationType = hookOptions.stateLocation;

  const FILTER_EXPANDED_STORAGE_KEY = `${config.tableName}-filters-expanded`;
  // Tracks which active-filter columns we have already auto-expanded once, so a
  // section the user later collapsed is never re-expanded — even across remounts
  // (route navigation away-and-back, tab reload). It shares the session lifecycle
  // of the expanded state itself, so the "already reconciled" knowledge survives
  // exactly as long as the manual collapse it must respect. See LFE-10164 below.
  const FILTER_SEEDED_STORAGE_KEY = `${config.tableName}-filters-seeded`;
  const DEFAULT_EXPANDED_FILTERS = config.defaultExpanded ?? [];

  const [expandedString, setExpandedString] = useSessionStorage<string>(
    FILTER_EXPANDED_STORAGE_KEY,
    DEFAULT_EXPANDED_FILTERS.join(","),
  );
  const expandedState = useMemo(() => {
    return expandedString.split(",").filter(Boolean);
  }, [expandedString]);
  const onExpandedChange = useCallback(
    (value: string[]) => {
      setExpandedString(value.join(","));
    },
    [setExpandedString],
  );

  const [seededString, setSeededString] = useSessionStorage<string>(
    FILTER_SEEDED_STORAGE_KEY,
    "",
  );

  const normalizedSessionFilterContextId =
    stateLocationType === "urlAndSessionStorage"
      ? (hookOptions.sessionFilterContextId ?? null)
      : null;
  const FILTER_QUERY_SESSION_STORAGE_KEY = buildSidebarFilterQueryStorageKey({
    tableName: config.tableName,
    contextId: normalizedSessionFilterContextId,
  });

  const [storedFilterQueryState, setStoredFilterQueryState] =
    useKeyedSessionStorageState<PersistedSidebarFilterQueryState>(
      FILTER_QUERY_SESSION_STORAGE_KEY,
      createPersistedSidebarFilterQueryState(
        normalizedSessionFilterContextId,
        "",
      ),
    );

  const storedFiltersQuery = getPersistedSidebarFilterQueryForContext({
    state: storedFilterQueryState,
    contextId: normalizedSessionFilterContextId,
  });
  const setStoredFiltersQuery = useCallback(
    (query: string) => {
      setStoredFilterQueryState(
        createPersistedSidebarFilterQueryState(
          normalizedSessionFilterContextId,
          query,
        ),
      );
    },
    [setStoredFilterQueryState, normalizedSessionFilterContextId],
  );
  const [urlFiltersQuery, setUrlFiltersQuery] = useQueryParam(
    "filter",
    StringParam,
  );
  // Optimistic query state: prevents stale URL reads from overriding immediate
  // local changes while use-query-params updates the URL asynchronously.
  const [pendingFiltersQuery, setPendingFiltersQuery] = useState<string | null>(
    null,
  );
  const [memoryFilterState, setMemoryFilterState] = useState<FilterState>([]);

  const urlFilterState: FilterState = useMemo(() => {
    if (
      stateLocationType !== "url" &&
      stateLocationType !== "urlAndSessionStorage"
    ) {
      return [];
    }

    const rawQuery = (() => {
      if (pendingFiltersQuery !== null) {
        return pendingFiltersQuery;
      }

      if (typeof urlFiltersQuery === "string") {
        return urlFiltersQuery;
      }

      if (stateLocationType === "urlAndSessionStorage") {
        return storedFiltersQuery;
      }

      return "";
    })();

    return decodeAndNormalizeFilters(
      rawQuery,
      config.columnDefinitions,
      config.migrateFilterState,
    );
  }, [
    config.columnDefinitions,
    config.migrateFilterState,
    stateLocationType,
    pendingFiltersQuery,
    urlFiltersQuery,
    storedFiltersQuery,
  ]);

  const canonicalFiltersQuery = useMemo(
    () => encodeFiltersGeneric(urlFilterState),
    [urlFilterState],
  );

  const persistedExplicitFilterState: FilterState =
    stateLocationType === "memory" ? memoryFilterState : urlFilterState;

  const explicitFilterState = useMemo(() => {
    const defaultFilters = hookOptions.defaultExplicitFilterState ?? [];
    if (defaultFilters.length === 0) return persistedExplicitFilterState;

    const explicitlyOwnedColumns = new Set(
      persistedExplicitFilterState.map((filter) => filter.column),
    );
    return persistedExplicitFilterState.concat(
      defaultFilters.filter(
        (filter) => !explicitlyOwnedColumns.has(filter.column),
      ),
    );
  }, [hookOptions.defaultExplicitFilterState, persistedExplicitFilterState]);

  // LFE-10164: When arriving via a URL/deep link that already carries applied
  // filters, expand the sidebar sections that have an active filter. Sidebar
  // sections are collapsed by default; without this, a bookmarked/shared link
  // would render its active facets collapsed. Sections without an active filter
  // keep their default state.
  //
  // We derive this during render (the "adjust state while rendering when a
  // derived input changes" pattern, https://react.dev/learn/you-might-not-need-an-effect)
  // rather than in a mount effect. The mount-effect approach had two defects:
  //   1. Late-arriving URL params: in the Pages Router `useQueryParam` reads
  //      `router.query`, which is empty on the first render of a direct
  //      navigation and only populated on a later render. A one-shot mount
  //      effect seeded against the empty first render and never re-ran, so
  //      deep-linked sections stayed collapsed. Reconciling during render means
  //      the moment the filters actually appear (a later render) we seed them.
  //   2. Remount re-seed: a per-mount guard re-expanded a section the user had
  //      deliberately collapsed whenever the page remounted. We instead persist
  //      which columns have already been auto-expanded (`seededString`, same
  //      session lifecycle as the expanded state) and only expand columns that
  //      are newly active and not yet reconciled, so a collapsed section is
  //      never re-expanded.
  //
  // We key off `explicitFilterState` (the URL/memory/peek-authored filters),
  // which already excludes the implicit hidden-environment default — so the
  // managed-environment section is only auto-expanded when the user actually
  // authored an environment filter.
  const seededSet = useMemo(
    () => new Set(seededString.split(",").filter(Boolean)),
    [seededString],
  );
  const facetColumnSet = useMemo(
    () => new Set(config.facets.map((facet) => facet.column)),
    [config.facets],
  );
  const newlyActiveFacetColumns = explicitFilterState
    .map((filter) => filter.column)
    .filter((column) => facetColumnSet.has(column) && !seededSet.has(column));
  if (newlyActiveFacetColumns.length > 0) {
    // setState-during-render (not an effect): React discards this render and
    // re-renders synchronously with the updated state before painting. The
    // updates are idempotent — once a column is in `seededSet` it is no longer
    // "newly active", so this branch does not re-run for it on the next render.
    setExpandedString((current) => {
      const expanded = current.split(",").filter(Boolean);
      const expandedSet = new Set(expanded);
      const next = [...expanded];
      for (const column of newlyActiveFacetColumns) {
        if (!expandedSet.has(column)) {
          expandedSet.add(column);
          next.push(column);
        }
      }
      return next.length === expanded.length ? current : next.join(",");
    });
    setSeededString((current) => {
      const seeded = current.split(",").filter(Boolean);
      const seededColumnSet = new Set(seeded);
      const next = [...seeded];
      for (const column of newlyActiveFacetColumns) {
        if (!seededColumnSet.has(column)) {
          seededColumnSet.add(column);
          next.push(column);
        }
      }
      return next.length === seeded.length ? current : next.join(",");
    });
  }

  const managedEnvironmentPolicyConfig = useMemo(
    () => buildManagedEnvironmentPolicyConfig(implicitDefaultConfig),
    [implicitDefaultConfig],
  );

  const managedEnvironmentColumn =
    managedEnvironmentPolicyConfig.managedEnvironmentColumn;

  // Context the pure facet-action functions (lib/sidebar-filter-actions)
  // read: facet/column metadata, the option lists, and — only while the
  // managed-environment policy is active — the managed column, which gates
  // its explicit enable-all-environments override.
  const actionContext: SidebarFilterActionContext = useMemo(
    () => ({
      facets: config.facets,
      columnDefinitions: config.columnDefinitions,
      options,
      managedEnvironmentColumn:
        managedEnvironmentPolicyConfig.hiddenEnvironments.length > 0
          ? managedEnvironmentColumn
          : undefined,
    }),
    [
      config.facets,
      config.columnDefinitions,
      options,
      managedEnvironmentColumn,
      managedEnvironmentPolicyConfig.hiddenEnvironments,
    ],
  );

  const effectiveEnvironmentFilterState: FilterState = useMemo(
    () =>
      buildEffectiveEnvironmentFilter({
        explicitFilters: explicitFilterState,
        config: managedEnvironmentPolicyConfig,
      }),
    [explicitFilterState, managedEnvironmentPolicyConfig],
  );

  const filterState: FilterState = useMemo(
    () =>
      explicitFilterState
        .filter((filter) => filter.column !== managedEnvironmentColumn)
        .concat(effectiveEnvironmentFilterState),
    [
      explicitFilterState,
      effectiveEnvironmentFilterState,
      managedEnvironmentColumn,
    ],
  );

  // `options.updateType` controls the history semantics of the URL write:
  // user-initiated filter edits keep the default (push — a Back-able step);
  // programmatic writes (e.g. the session default-view auto-apply) pass
  // `replaceIn` so they don't mint a history entry Back would bounce off
  // (LFE-10715). Ignored for non-URL state locations.
  const setFilterState = useCallback(
    (
      newFilters: FilterState,
      options?: {
        updateType?: UrlUpdateType;
        origin?: "user" | "saved_view" | "system";
      },
    ) => {
      const explicitFilters = stripImplicitEnvironmentFilterFromExplicitState({
        explicitFilters: newFilters,
        config: managedEnvironmentPolicyConfig,
      });

      onExplicitFilterStateChange?.({
        previousFilters: explicitFilterState,
        nextFilters: explicitFilters,
        origin: options?.origin ?? "user",
      });

      if (stateLocationType === "memory") {
        setMemoryFilterState(explicitFilters);
        return;
      }

      const encoded = encodeFiltersGeneric(explicitFilters);
      const urlQuery =
        stateLocationType === "urlAndSessionStorage"
          ? toUrlFilterQuery(encoded)
          : encoded;
      if (urlQuery !== encoded) {
        console.warn(
          `Filter state (${encoded.length} chars) exceeds the URL budget; persisting it in session storage only.`,
        );
      }
      setPendingFiltersQuery(encoded);
      // Eviction of an oversized state replaces the current history entry
      // regardless of the caller's updateType: repeated interactions in the
      // oversized regime must not push a stack of identical param-less
      // entries the Back button has to walk through.
      setUrlFiltersQuery(
        urlQuery || null,
        urlQuery !== encoded ? "replaceIn" : options?.updateType,
      );
      if (stateLocationType === "urlAndSessionStorage") {
        setStoredFiltersQuery(encoded);
      }
    },
    [
      stateLocationType,
      setUrlFiltersQuery,
      setStoredFiltersQuery,
      managedEnvironmentPolicyConfig,
      explicitFilterState,
      onExplicitFilterStateChange,
    ],
  );

  // Drop optimistic override once URL catches up to the requested value.
  useEffect(() => {
    if (
      stateLocationType !== "url" &&
      stateLocationType !== "urlAndSessionStorage"
    ) {
      return;
    }
    if (pendingFiltersQuery === null) return;

    const normalizedUrlFiltersQuery = urlFiltersQuery ?? "";
    // An oversized pending query is intentionally never written to the URL;
    // it has "caught up" once the URL param is gone (state then reads from
    // the session-storage mirror).
    const expectedUrlFiltersQuery =
      stateLocationType === "urlAndSessionStorage"
        ? toUrlFilterQuery(pendingFiltersQuery)
        : pendingFiltersQuery;
    if (normalizedUrlFiltersQuery === expectedUrlFiltersQuery) {
      setPendingFiltersQuery(null);
    }
  }, [stateLocationType, pendingFiltersQuery, urlFiltersQuery]);

  // Sanitize stale or outdated filter queries in URL/session state.
  // TODO(2026-04-15): Remove this entire effect once stale
  // positionInTrace traces-table URL/session state has aged out.
  // Remove the canonicalFiltersQuery cleanup path here and the matching
  // stale-positionInTrace migration tests in sidebarFilterSessionPersistence
  // / filter-integration when this is no longer needed.
  useEffect(() => {
    if (
      stateLocationType !== "url" &&
      stateLocationType !== "urlAndSessionStorage"
    ) {
      return;
    }

    if (pendingFiltersQuery !== null) return;

    if (typeof urlFiltersQuery === "string") {
      // Canonicalization also evicts an oversized query that arrived via the
      // URL (e.g. a legacy complement-filter link): it moves to the
      // session-storage mirror instead of being rewritten into the URL.
      const canonicalUrlQuery =
        stateLocationType === "urlAndSessionStorage"
          ? toUrlFilterQuery(canonicalFiltersQuery)
          : canonicalFiltersQuery;
      if (urlFiltersQuery !== canonicalUrlQuery) {
        setPendingFiltersQuery(canonicalFiltersQuery);
        // replaceIn: sanitizing is a programmatic correction of the current
        // URL — pushing would mint a history entry holding the non-canonical
        // filter, which Back lands on and this effect re-fires (LFE-10715).
        // Same for evicting an oversized query (canonicalUrlQuery = ""):
        // pushing would turn Back into a rewrite loop on a legacy giant link.
        setUrlFiltersQuery(canonicalUrlQuery || null, "replaceIn");
      }

      if (
        stateLocationType === "urlAndSessionStorage" &&
        storedFiltersQuery !== canonicalFiltersQuery
      ) {
        setStoredFiltersQuery(canonicalFiltersQuery);
      }
      return;
    }

    if (
      stateLocationType === "urlAndSessionStorage" &&
      storedFiltersQuery !== canonicalFiltersQuery
    ) {
      setStoredFiltersQuery(canonicalFiltersQuery);
    }
  }, [
    stateLocationType,
    pendingFiltersQuery,
    urlFiltersQuery,
    storedFiltersQuery,
    canonicalFiltersQuery,
    setStoredFiltersQuery,
    setUrlFiltersQuery,
  ]);

  // Mirror explicit URL filter state into session fallback storage.
  useEffect(() => {
    if (stateLocationType !== "urlAndSessionStorage") return;
    if (pendingFiltersQuery !== null) return;
    if (typeof urlFiltersQuery !== "string") return;
    if (!urlFiltersQuery) return;
    if (urlFiltersQuery === storedFiltersQuery) return;

    // Keep session fallback aligned to explicit URL links without clearing
    // previously saved state when URL has no `filter` parameter.
    setStoredFiltersQuery(urlFiltersQuery);
  }, [
    stateLocationType,
    pendingFiltersQuery,
    urlFiltersQuery,
    storedFiltersQuery,
    setStoredFiltersQuery,
  ]);

  // When true, the applied-filter capture inside `updateFilter` is suppressed —
  // set by `updateOperator`, which funnels through `updateFilter` but must emit
  // `filters:facet_operator_toggled` instead of a duplicate `filters:applied`.
  const suppressAppliedCaptureRef = useRef(false);

  // Emit `filters:applied` for a single facet interaction. METADATA ONLY: we
  // derive shape (type/operator/key/counts) from the RESULTING filters for the
  // column and never send the raw filter value (PII). Skips emission when the
  // column ends up with no filter (a deselect-to-empty is a clear, not an
  // apply). Count semantics are aligned with the popover builder (LFE-10781
  // review): `conditionCount` = TOTAL applied conditions across ALL columns
  // (whole-filter complexity); `columnConditionCount` = rows this column
  // produced (a numeric range is 2: >= and <=); `valueCount` = selected options
  // in the attributed condition.
  //
  // `prev` (the pre-change state) lets us attribute the event to the row the
  // user JUST added/changed rather than the oldest one on the column — critical
  // for keyed facets (metadata / scores) that hold several rows per column
  // (adding `metadata.env` on top of `metadata.user_id` must report `env`, not
  // `user_id`). We pick the entry absent from `prev` (added or value-changed);
  // failing that, the last (appended) entry. The identity used to match rows
  // includes the raw value but is only ever compared locally — it is NEVER put
  // on the event payload.
  const emitFilterApplied = useCallback(
    (
      surface: "sidebar" | "filter_builder",
      column: string,
      next: FilterState,
      prev?: FilterState,
    ) => {
      const colFilters = next.filter((f) => f.column === column);
      if (colFilters.length === 0) return;
      const identity = (f: FilterState[number]): string =>
        `${"key" in f ? f.key : ""}\u0000${f.operator}\u0000${JSON.stringify(
          "value" in f ? f.value : null,
        )}`;
      const prevIdentities = new Set(
        (prev ?? []).filter((f) => f.column === column).map((f) => identity(f)),
      );
      const changed = colFilters.find((f) => !prevIdentities.has(identity(f)));
      const primary = changed ?? colFilters[colFilters.length - 1];
      capture("filters:applied", {
        surface,
        tableName: config.tableName,
        column,
        filterType: primary.type,
        operator: primary.operator,
        ...("key" in primary && primary.key ? { key: primary.key } : {}),
        valueCount: Array.isArray(primary.value) ? primary.value.length : 1,
        conditionCount: next.length,
        columnConditionCount: colFilters.length,
        isV4: isV4Surface,
      });
    },
    [capture, config.tableName, isV4Surface],
  );

  const clearAll = () => {
    const clearedCount = explicitFilterState.length;
    setFilterState([]);
    if (clearedCount > 0) {
      capture("filters:cleared", {
        surface: "sidebar",
        tableName: config.tableName,
        scope: "all",
        clearedCount,
        isV4: isV4Surface,
      });
    }
  };

  // One facet's clear affordance (the header ✕ / reset paths). Metadata
  // only: the column id and how many filter rows were removed.
  const emitFacetCleared = useCallback(
    (column: string, clearedCount: number) => {
      capture("filters:cleared", {
        surface: "sidebar",
        tableName: config.tableName,
        scope: "facet",
        column,
        clearedCount,
        isV4: isV4Surface,
      });
    },
    [capture, config.tableName, isV4Surface],
  );

  const updateFilter: UpdateFilter = useCallback(
    (column, values, operator?: "any of" | "none of" | "all of") => {
      const next = applyCheckboxSelection(
        actionContext,
        filterState,
        column,
        values,
        operator,
      );
      setFilterState(next);
      if (!suppressAppliedCaptureRef.current) {
        emitFilterApplied("sidebar", column, next);
      }
    },
    [actionContext, filterState, setFilterState, emitFilterApplied],
  );

  const updateFilterOnly = useCallback(
    (column: string, value: string) => {
      const selection = buildOnlySelection(
        actionContext,
        filterState,
        column,
        value,
      );
      if (!selection) return;
      updateFilter(column, selection.values, selection.operator);
    },
    [actionContext, filterState, updateFilter],
  );

  const emitOperatorToggled = useCallback(
    (
      column: string,
      fromOperator: string | undefined,
      toOperator: "any of" | "all of" | "none of",
      valueCount: number,
    ) => {
      capture("filters:facet_operator_toggled", {
        surface: "sidebar",
        tableName: config.tableName,
        column,
        fromOperator,
        toOperator,
        valueCount,
        isV4: isV4Surface,
      });
    },
    [capture, config.tableName, isV4Surface],
  );

  // Runs `updateFilter` without the `filters:applied` capture, so the operator
  // toggle emits exactly one `filters:facet_operator_toggled` (not both events).
  const applyOperatorChange = useCallback(
    (
      column: string,
      values: string[],
      operator: "any of" | "all of" | "none of",
    ) => {
      suppressAppliedCaptureRef.current = true;
      try {
        updateFilter(column, values, operator);
      } finally {
        suppressAppliedCaptureRef.current = false;
      }
    },
    [updateFilter],
  );

  const updateOperator = useCallback(
    (column: string, newOperator: "any of" | "all of" | "none of") => {
      const change = deriveOperatorChange(actionContext, filterState, column);
      if (!change) return;
      applyOperatorChange(column, change.values, newOperator);
      emitOperatorToggled(
        column,
        change.fromOperator,
        newOperator,
        change.values.length,
      );
    },
    [actionContext, filterState, applyOperatorChange, emitOperatorToggled],
  );

  const updateNumericFilter = useCallback(
    (
      column: string,
      value: [number, number] | null,
      _defaultMin: number,
      _defaultMax: number,
    ) => {
      const next = applyNumericRange(filterState, column, value);
      setFilterState(next);
      // null clears the column — a reset, not an apply.
      if (value !== null) {
        emitFilterApplied("sidebar", column, next);
      } else if (next.length < filterState.length) {
        emitFacetCleared(column, filterState.length - next.length);
      }
    },
    [filterState, setFilterState, emitFilterApplied, emitFacetCleared],
  );

  const updateStringFilter = useCallback(
    (column: string, value: string) => {
      const next = applyStringContains(filterState, column, value);
      setFilterState(next);
      // Blank input clears the column — a reset, not an apply.
      if (value.trim() !== "") {
        emitFilterApplied("sidebar", column, next);
      } else if (next.length < filterState.length) {
        emitFacetCleared(column, filterState.length - next.length);
      }
    },
    [filterState, setFilterState, emitFilterApplied, emitFacetCleared],
  );

  // Text filter management for categorical filters
  // Mutually exclusive with checkbox selections
  const addTextFilter = useCallback(
    (
      column: string,
      operator: "contains" | "does not contain",
      value: string,
    ) => {
      const next = addTextFilterEntry(filterState, column, operator, value);
      if (next === null) return; // blank input
      setFilterState(next);
      emitFilterApplied("sidebar", column, next);
    },
    [filterState, setFilterState, emitFilterApplied],
  );

  const removeTextFilter = useCallback(
    (
      column: string,
      operator: "contains" | "does not contain",
      value: string,
    ) => {
      const next = removeTextFilterEntry(filterState, column, operator, value);
      setFilterState(next);
      // Removing the LAST row on the column is a facet clear; removing one
      // of several is an edit and stays silent.
      if (
        next.length < filterState.length &&
        !next.some((f) => f.column === column)
      ) {
        emitFacetCleared(column, 1);
      }
    },
    [filterState, setFilterState, emitFacetCleared],
  );

  // Keyed facets (metadata, categorical/numeric/boolean/string scores) share
  // one apply/reset pair; the per-kind row semantics live in
  // applyKeyedFilterEntries. Unifying them here also closes an analytics gap:
  // boolean-score applies previously called the raw setter and emitted
  // nothing (Rule 5 of the instrumentation skill).
  const updateKeyedFilter = useCallback(
    (column: string, update: Parameters<typeof applyKeyedFilterEntries>[2]) => {
      const next = applyKeyedFilterEntries(filterState, column, update);
      setFilterState(next);
      // Analytics (LFE-10781): `prev` attributes the event to the row the
      // user just added or changed, not the column's oldest row.
      emitFilterApplied("sidebar", column, next, filterState);
    },
    [filterState, setFilterState, emitFilterApplied],
  );

  const resetKeyedFilter = useCallback(
    (column: string, kind: KeyedFilterKind) => {
      const next = removeColumnFiltersOfType(filterState, column, kind);
      setFilterState(next);
      if (next.length < filterState.length) {
        emitFacetCleared(column, filterState.length - next.length);
      }
    },
    [filterState, setFilterState, emitFacetCleared],
  );

  const filters: UIFilter[] = useMemo((): UIFilter[] => {
    const expandedSet = new Set(expandedState);

    const builderCtx: FilterBuilderContext = {
      filterState,
      explicitFilterState,
      options,
      expandedSet,
      columnDefinitions: config.columnDefinitions,
      managedEnvironmentColumn,
      hiddenEnvironments: managedEnvironmentPolicyConfig.hiddenEnvironments,
      loadingColumns,
      loading,
      updateFilter,
      updateFilterOnly,
      updateOperator,
      updateNumericFilter,
      updateStringFilter,
      addTextFilter,
      removeTextFilter,
      updateKeyedFilter,
      resetKeyedFilter,
      setFilterState,
      emitFacetCleared,
    };

    return config.facets
      .map((facet): UIFilter | null => {
        switch (facet.type) {
          case "numeric":
            return buildNumericFilter(facet, builderCtx);
          case "string":
            return buildStringFilter(facet, builderCtx);
          case "keyValue":
            return buildKeyValueFilter(facet, builderCtx);
          case "numericKeyValue":
            return buildNumericKeyValueFilter(facet, builderCtx);
          case "booleanKeyValue":
            return buildBooleanKeyValueFilter(facet, builderCtx);
          case "stringKeyValue":
            return buildStringKeyValueFilter(facet, builderCtx);
          case "boolean":
            return buildBooleanFilter(facet, builderCtx);
          default:
            return buildCategoricalFilter(facet, builderCtx);
        }
      })
      .filter((f): f is UIFilter => f !== null);
  }, [
    config,
    options,
    loading,
    loadingColumns,
    filterState,
    explicitFilterState,
    updateFilter,
    updateFilterOnly,
    updateOperator,
    updateNumericFilter,
    updateStringFilter,
    addTextFilter,
    removeTextFilter,
    updateKeyedFilter,
    resetKeyedFilter,
    emitFacetCleared,
    expandedState,
    setFilterState,
    managedEnvironmentColumn,
    managedEnvironmentPolicyConfig.hiddenEnvironments,
  ]);

  return {
    filterState,
    effectiveFilterState: filterState,
    explicitFilterState,
    setFilterState,
    updateFilter,
    updateFilterOnly,
    updateOperator,
    clearAll,
    isFiltered: explicitFilterState.length > 0,
    filters,
    expanded: expandedState,
    onExpandedChange,
    // Exposed so view-layer captures (DataTableControls) carry the same
    // v3-vs-v4 dimension as the hook's own events.
    isV4: isV4Surface,
  };
}
