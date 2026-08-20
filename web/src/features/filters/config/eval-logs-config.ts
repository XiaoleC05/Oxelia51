import { evalExecutionsFilterCols } from "@/src/server/api/definitions/evalExecutionsTable";
import type { FilterConfig } from "@/src/features/filters/lib/filter-config";

export const evalLogFilterConfig: FilterConfig = {
  tableName: "evalLogs",

  columnDefinitions: evalExecutionsFilterCols,

  defaultExpanded: ["status"],

  defaultSidebarCollapsed: true,

  facets: [
    {
      type: "categorical" as const,
      column: "status",
      label: "状态",
    },
    {
      type: "string" as const,
      column: "traceId",
      label: "追踪 ID",
    },
    {
      type: "string" as const,
      column: "executionTraceId",
      label: "执行追踪 ID",
    },
  ],
};
