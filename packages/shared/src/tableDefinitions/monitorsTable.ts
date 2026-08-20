import { z } from "zod";

import { ColumnDefinition } from "./types";

// Inlined wire forms of the legacy Prisma MonitorSeverity / MonitorStatus
// enums (the monitors feature itself has been removed from this package).
const MonitorSeveritySchema = z.enum([
  "PAUSED",
  "UNKNOWN",
  "NO_DATA",
  "OK",
  "WARNING",
  "ALERT",
]);
const MonitorStatusSchema = z.enum(["PAUSED", "ACTIVE", "ERROR_BAD_QUERY"]);

/** monitorsTableCols defines the columns the monitors list filter sidebar narrows by. */
export const monitorsTableCols: ColumnDefinition[] = [
  {
    name: "Severity",
    id: "severity",
    type: "stringOptions",
    internal: 'm."severity"',
    options: MonitorSeveritySchema.options.map((value) => ({ value })),
  },
  {
    name: "Name",
    id: "name",
    type: "string",
    internal: 'm."name"',
  },
  {
    name: "Status",
    id: "status",
    type: "stringOptions",
    internal: 'm."status"',
    options: MonitorStatusSchema.options.map((value) => ({ value })),
  },
  {
    name: "Tags",
    id: "tags",
    type: "arrayOptions",
    internal: 'm."tags"',
    options: [],
  },
];
