import { monitorsTableCols } from "@oxelia51/shared";
import type { FilterConfig } from "@/src/features/filters/lib/filter-config";

export const monitorFilterConfig: FilterConfig = {
  tableName: "monitors",

  columnDefinitions: monitorsTableCols,

  defaultExpanded: ["severity", "tags"],

  defaultSidebarCollapsed: false,

  facets: [
    {
      type: "categorical" as const,
      column: "severity",
      label: "严重程度",
      disableTextFilter: true,
    },
    {
      type: "categorical" as const,
      column: "tags",
      label: "标签",
    },
  ],
};
