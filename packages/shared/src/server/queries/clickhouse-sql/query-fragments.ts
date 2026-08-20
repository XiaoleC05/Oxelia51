/**
 * Reusable ClickHouse query fragments and CTEs
 */

import { EventsAggregationQueryBuilder } from "./event-query-builder";

interface EventsTracesAggregationParams {
  projectId: string;
  traceIds?: string[];
  startTimeFrom?: string | null;
  orderByTimestamp?: boolean;
  /**
   * Whether to use truncated I/O (events_core) or full I/O (events_full).
   * Default is false (full) for better compatibility.
   */
  truncated?: boolean;
}

/**
 * Rebuilds traces from events table by aggregating events with the same trace_id.
 * Groups events by trace_id and project_id, selecting representative fields
 * and aggregating timestamps.
 *
 * Note: This is a temporary solution until we fully migrate to using only the events table.
 *       Some legacy fields are still included for compatibility and should be removed in the future.
 */
export const eventsTracesAggregation = (
  params: EventsTracesAggregationParams,
): EventsAggregationQueryBuilder => {
  const builder = new EventsAggregationQueryBuilder({
    projectId: params.projectId,
  })
    // we always use this as CTE, no need to be smart here.
    // ClickHouse will optimize unused columns away.
    .selectFieldSet("all")
    .withTraceIds(params.traceIds)
    .withStartTimeFrom(params.startTimeFrom)
    .withTruncated(params.truncated ?? false);

  if (params.orderByTimestamp ?? true) {
    builder.orderByColumns([{ column: "timestamp", direction: "DESC" }]);
  }

  return builder;
};
