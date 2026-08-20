import { omitFilterFacets } from "@/src/features/filters/lib/filter-config";
import { sessionsEventsViewCols, sessionsViewCols } from "@oxelia51/shared";
import type {
  Facet,
  FilterConfig,
} from "@/src/features/filters/lib/filter-config";
import type { ColumnToBackendKeyMap } from "@/src/features/filters/lib/filter-transform";

export type SessionOmittableFilterColumn = "userIds";

/**
 * Maps frontend column IDs to backend-expected column IDs
 * Frontend uses "tags" but backend CH mapping expects "traceTags" for trace tags on sessions table
 */
export const SESSION_COLUMN_TO_BACKEND_KEY: ColumnToBackendKeyMap = {
  tags: "traceTags",
};

export const sessionFilterConfig: FilterConfig = {
  tableName: "sessions",

  columnDefinitions: sessionsViewCols,

  defaultExpanded: ["environment", "bookmarked"],

  facets: [
    {
      type: "categorical" as const,
      column: "environment",
      label: "环境",
    },
    {
      type: "string" as const,
      column: "id",
      label: "会话 ID",
    },
    {
      type: "categorical" as const,
      column: "userIds",
      label: "用户 ID",
    },
    {
      type: "categorical" as const,
      column: "tags",
      label: "追踪标签",
    },
    {
      type: "boolean" as const,
      column: "bookmarked",
      label: "已收藏",
      trueLabel: "已收藏",
      falseLabel: "未收藏",
    },
    {
      type: "numeric" as const,
      column: "sessionDuration",
      label: "会话时长",
      min: 0,
      max: 3600,
      unit: "s",
    },
    {
      type: "numeric" as const,
      column: "countTraces",
      label: "追踪数",
      min: 0,
      max: 1000,
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

const sessionMetadataFacet: Facet = {
  type: "stringKeyValue",
  column: "metadata",
  label: "元数据",
};

export const sessionEventsFilterConfig: FilterConfig = {
  ...sessionFilterConfig,
  columnDefinitions: sessionsEventsViewCols,
  facets: sessionFilterConfig.facets.flatMap((facet) =>
    facet.column === "tags" ? [facet, sessionMetadataFacet] : [facet],
  ),
};

export function getSessionFilterConfig(
  omittedFilter: SessionOmittableFilterColumn[] = [],
  fromEvents = false,
): FilterConfig {
  return omitFilterFacets(
    fromEvents ? sessionEventsFilterConfig : sessionFilterConfig,
    omittedFilter,
  );
}
