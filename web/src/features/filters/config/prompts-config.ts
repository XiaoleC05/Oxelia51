import { promptsTableCols } from "@oxelia51/shared";
import type { FilterConfig } from "@/src/features/filters/lib/filter-config";

export const promptFilterConfig: FilterConfig = {
  tableName: "prompts",

  columnDefinitions: promptsTableCols,

  defaultExpanded: ["type"],

  defaultSidebarCollapsed: true,

  facets: [
    {
      type: "categorical" as const,
      column: "type",
      label: "类型",
    },
    {
      type: "categorical" as const,
      column: "labels",
      label: "标记",
    },
    {
      type: "categorical" as const,
      column: "tags",
      label: "标签",
    },
    {
      type: "numeric" as const,
      column: "version",
      label: "版本",
      min: 1,
      max: 100,
    },
  ],
};
