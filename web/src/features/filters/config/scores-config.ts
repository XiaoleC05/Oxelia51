import { scoresTableCols } from "@/src/server/api/definitions/scoresTable";
import type { FilterConfig } from "@/src/features/filters/lib/filter-config";
import type { ColumnToBackendKeyMap } from "@/src/features/filters/lib/filter-transform";

// Maps frontend column IDs to backend-expected column IDs
// Frontend uses "tags" but backend CH mapping expects "trace_tags" for trace tags on scores table
export const SCORE_COLUMN_TO_BACKEND_KEY: ColumnToBackendKeyMap = {
  tags: "trace_tags",
};

export type ScoresTableHiddenColumn =
  | "traceId"
  | "traceName"
  | "observationId"
  | "jobConfigurationId"
  | "userId"
  | "traceTags";

const SCORES_HIDDEN_COLUMN_TO_FILTER_COLUMN: Partial<
  Record<ScoresTableHiddenColumn, string>
> = {
  traceTags: "tags",
};

export const scoreFilterConfig: FilterConfig = {
  tableName: "scores",

  columnDefinitions: scoresTableCols,

  defaultExpanded: ["environment", "name"],

  defaultSidebarCollapsed: true,

  facets: [
    {
      type: "categorical" as const,
      column: "environment",
      label: "环境",
    },
    {
      type: "categorical" as const,
      column: "name",
      label: "名称",
    },
    {
      type: "categorical" as const,
      column: "source",
      label: "来源",
    },
    {
      type: "categorical" as const,
      column: "dataType",
      label: "数据类型",
    },
    {
      type: "numeric" as const,
      column: "value",
      label: "数值",
      tooltip:
        "按数值筛选评分。BOOLEAN 类型的评分请使用下方的「布尔值」筛选,CATEGORICAL 类型的评分请使用下方的「分类值」筛选。",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "categorical" as const,
      column: "booleanValue",
      label: "布尔值",
      tooltip: "按 true 或 false 筛选 BOOLEAN 类型的评分。",
      disableTextFilter: true,
    },
    {
      type: "categorical" as const,
      column: "stringValue",
      label: "分类值",
      tooltip: "按字符串值筛选评分。仅适用于 CATEGORICAL 数据类型的评分。",
    },
    {
      type: "string" as const,
      column: "traceId",
      label: "追踪 ID",
    },
    {
      type: "string" as const,
      column: "sessionId",
      label: "会话 ID",
    },
    {
      type: "categorical" as const,
      column: "traceName",
      label: "追踪名称",
    },
    {
      type: "string" as const,
      column: "observationId",
      label: "观测 ID",
    },
    {
      type: "categorical" as const,
      column: "userId",
      label: "用户 ID",
    },
    {
      type: "categorical" as const,
      column: "tags",
      label: "追踪标签",
    },
  ],
};

export function getScoreFilterConfig(
  hiddenColumns: ScoresTableHiddenColumn[] = [],
): FilterConfig {
  if (hiddenColumns.length === 0) {
    return scoreFilterConfig;
  }
  const hiddenColumnSet = new Set<string>(
    hiddenColumns.map(
      (column) => SCORES_HIDDEN_COLUMN_TO_FILTER_COLUMN[column] ?? column,
    ),
  );

  return {
    ...scoreFilterConfig,
    defaultExpanded: scoreFilterConfig.defaultExpanded?.filter(
      (column) => !hiddenColumnSet.has(column),
    ),
    facets: scoreFilterConfig.facets.filter(
      (facet) => !hiddenColumnSet.has(facet.column),
    ),
  };
}
