import { tracesTableCols } from "@oxelia51/shared";
import {
  omitFilterFacets,
  type FilterConfig,
} from "@/src/features/filters/lib/filter-config";
import { renderLevelIcon } from "@/src/components/level-colors";

export type TraceOmittableFilterColumn = "userId" | "sessionId";

export const traceFilterConfig: FilterConfig = {
  tableName: "traces",

  columnDefinitions: tracesTableCols,

  defaultExpanded: ["environment", "traceName"],

  facets: [
    {
      type: "categorical" as const,
      column: "environment",
      label: "环境",
    },
    {
      type: "categorical" as const,
      column: "traceName",
      label: "追踪名称",
    },
    {
      type: "string" as const,
      column: "id",
      label: "追踪ID",
    },
    {
      type: "categorical" as const,
      column: "userId",
      label: "用户ID",
    },
    {
      type: "categorical" as const,
      column: "sessionId",
      label: "会话ID",
    },
    {
      // Tags are a primary, user-defined filter — keep them near the identity
      // facets at the top of the sidebar rather than buried mid-list (LFE-10494).
      type: "categorical" as const,
      column: "traceTags",
      label: "标签",
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
      type: "string" as const,
      column: "release",
      label: "发布",
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
    {
      // Product direction is to call observation levels "Status" everywhere
      // (display relabel only here; the column id / grammar field stays
      // `level` until the cross-surface rename lands).
      type: "categorical" as const,
      column: "level",
      label: "状态",
      renderIcon: renderLevelIcon,
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
      column: "inputTokens",
      label: "输入Token",
      min: 0,
      max: 1000000,
    },
    {
      type: "numeric" as const,
      column: "outputTokens",
      label: "输出Token",
      min: 0,
      max: 1000000,
    },
    {
      type: "numeric" as const,
      column: "totalTokens",
      label: "总Token",
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
  ],
};

export function getTraceFilterConfig(
  omittedFilter: TraceOmittableFilterColumn[] = [],
): FilterConfig {
  return omitFilterFacets(traceFilterConfig, omittedFilter);
}
