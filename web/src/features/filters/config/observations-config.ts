import { observationsTableCols } from "@oxelia51/shared";
import {
  omitFilterFacets,
  type FilterConfig,
} from "@/src/features/filters/lib/filter-config";
import type { ColumnToBackendKeyMap } from "@/src/features/filters/lib/filter-transform";
import { renderFilterIcon } from "@/src/components/ItemBadge";
import { renderLevelIcon } from "@/src/components/level-colors";

export type ObservationsOmittableFilterColumn = "model" | "promptName";

/**
 * Maps frontend column IDs to backend-expected column IDs
 * Frontend uses "tags" but backend CH mapping expects "traceTags" for trace tags on observations table
 */
export const OBSERVATION_COLUMN_TO_BACKEND_KEY: ColumnToBackendKeyMap = {
  tags: "traceTags",
};

export const observationFilterConfig: FilterConfig = {
  tableName: "observations",

  columnDefinitions: observationsTableCols,

  defaultExpanded: ["environment", "name"],

  facets: [
    {
      type: "categorical" as const,
      column: "environment",
      label: "环境",
    },
    {
      type: "categorical" as const,
      column: "type",
      label: "类型",
      renderIcon: renderFilterIcon,
    },
    {
      type: "categorical" as const,
      column: "name",
      label: "名称",
    },
    {
      type: "categorical" as const,
      column: "traceName",
      label: "追踪名称",
    },
    {
      // Tags are a primary, user-defined filter — keep them near the identity
      // facets at the top of the sidebar rather than buried mid-list (LFE-10494).
      type: "categorical" as const,
      column: "tags",
      label: "追踪标签",
    },
    {
      // Display relabel to "Status" (see traces-config); column id stays
      // `level` until the cross-surface rename lands.
      type: "categorical" as const,
      column: "level",
      label: "状态",
      renderIcon: renderLevelIcon,
    },
    {
      type: "categorical" as const,
      column: "model",
      label: "模型",
    },
    {
      type: "categorical" as const,
      column: "modelId",
      label: "模型 ID",
    },
    {
      type: "categorical" as const,
      column: "promptName",
      label: "提示词名称",
    },
    {
      type: "stringKeyValue" as const,
      column: "metadata",
      label: "元数据",
    },
    {
      type: "string" as const,
      column: "version",
      label: "版本",
    },
    {
      type: "numeric" as const,
      column: "latency",
      label: "延迟",
      min: 0,
      max: 60,
      unit: "s",
    },
    {
      type: "numeric" as const,
      column: "timeToFirstToken",
      label: "首个 Token 时间",
      min: 0,
      max: 60,
      unit: "s",
    },
    {
      type: "numeric" as const,
      column: "inputTokens",
      label: "输入 Token",
      min: 0,
      max: 1000000,
    },
    {
      type: "numeric" as const,
      column: "outputTokens",
      label: "输出 Token",
      min: 0,
      max: 1000000,
    },
    {
      type: "numeric" as const,
      column: "totalTokens",
      label: "总 Token",
      min: 0,
      max: 1000000,
    },
    {
      type: "numeric" as const,
      column: "inputCost",
      label: "输入成本",
      min: 0,
      max: 100,
      unit: "$",
    },
    {
      type: "numeric" as const,
      column: "outputCost",
      label: "输出成本",
      min: 0,
      max: 100,
      unit: "$",
    },
    {
      type: "numeric" as const,
      column: "totalCost",
      label: "总成本",
      min: 0,
      max: 100,
      unit: "$",
    },
    {
      type: "categorical" as const,
      column: "toolNames",
      label: "工具名称(可用)",
    },
    {
      type: "categorical" as const,
      column: "calledToolNames",
      label: "工具名称(已调用)",
    },
    {
      type: "numeric" as const,
      column: "toolDefinitions",
      label: "可用工具",
      min: 0,
      max: 25,
    },
    {
      type: "numeric" as const,
      column: "toolCalls",
      label: "工具调用",
      min: 0,
      max: 25,
    },
    {
      type: "keyValue" as const,
      column: "score_categories",
      label: "分类评分",
    },
    {
      type: "numericKeyValue" as const,
      column: "scores_avg",
      label: "数值评分",
    },
    {
      type: "booleanKeyValue" as const,
      column: "score_booleans",
      label: "布尔评分",
    },
    {
      type: "numeric" as const,
      column: "commentCount",
      label: "评论数",
      min: 0,
      max: 100,
    },
    {
      type: "string" as const,
      column: "commentContent",
      label: "评论内容",
    },
  ],
};

export function getObservationsFilterConfig(
  omittedFilter: ObservationsOmittableFilterColumn[] = [],
): FilterConfig {
  return omitFilterFacets(observationFilterConfig, omittedFilter);
}
