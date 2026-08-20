// Slim restoration after the Langfuse tracing-domain convergence: this module
// keeps only the event-table read paths that retained web code still imports
// (trace access checks in tRPC and project activity timestamps).
import { env } from "../../env";
import { recordDistribution } from "../instrumentation";
import {
  convertDateToClickhouseDateTime,
  type PreferredClickhouseService,
} from "../clickhouse/client";
import {
  DEFAULT_RENDERING_PROPS,
  type RenderingProps,
} from "../utils/rendering";
import { eventsTracesAggregation } from "../queries/clickhouse-sql/query-fragments";
import { CTEQueryBuilder } from "../queries/clickhouse-sql/event-query-builder";
import {
  parseClickhouseUTCDateTimeFormat,
  queryClickhouse,
} from "./clickhouse";
import { type TraceRecordReadType } from "./definitions";
import { convertClickhouseToDomain } from "./traces_converters";
import {
  getLastTraceTimestampsByProjectsFromTracesTable,
  getTraceByIdFromTracesTable,
} from "./traces";

/**
 * Get a trace by ID from the events table.
 * Compatible with getTraceById but queries the events table instead.
 *
 * Avoid using the `excludeInputOutput` and `excludeMetadata` fields as they
 * are only for backwards compatibility with the existing `getTraceById` interface.
 */
export const getTraceByIdFromEventsTable = async ({
  traceId,
  projectId,
  timestamp,
  fromTimestamp,
  renderingProps = DEFAULT_RENDERING_PROPS,
  preferredClickhouseService,
  excludeInputOutput = false,
  excludeMetadata = false,
}: {
  traceId: string;
  projectId: string;
  timestamp?: Date;
  fromTimestamp?: Date;
  renderingProps?: RenderingProps;
  preferredClickhouseService?: PreferredClickhouseService;
  /** When true, sets input/output columns to empty in the query to reduce database load */
  excludeInputOutput?: boolean;
  /** When true, sets metadata column to empty in the query to reduce database load */
  excludeMetadata?: boolean;
}) => {
  // Build traces CTE using eventsTracesAggregation
  // Pass truncated flag to select events_core (truncated) or events_full (full I/O)
  const tracesBuilder = eventsTracesAggregation({
    projectId,
    traceIds: [traceId],
    startTimeFrom: fromTimestamp
      ? convertDateToClickhouseDateTime(fromTimestamp)
      : null,
    truncated: renderingProps.truncated,
  });

  // Build the final query
  const queryBuilder = new CTEQueryBuilder()
    .withCTEFromBuilder("traces", tracesBuilder)
    .from("traces", "t")
    .selectColumns(
      "t.id",
      "t.name",
      "t.user_id",
      "t.release",
      "t.version",
      "t.project_id",
      "t.environment",
      "t.public",
      "t.bookmarked",
      "t.tags",
      "t.session_id",
      "t.timestamp",
      "t.created_at",
      "t.updated_at",
    )
    .select(excludeMetadata ? "map() as metadata" : "t.metadata")
    .select("0 as is_deleted");

  if (timestamp) {
    queryBuilder.whereRaw(
      `toDate(t.timestamp) = toDate({timestamp: DateTime64(3)})`,
      {
        timestamp: convertDateToClickhouseDateTime(timestamp),
      },
    );
  }

  // Handle input/output with truncation
  // Note: eventsTracesAggregation above is responsible for choosing events_core/events_full
  if (excludeInputOutput) {
    queryBuilder.select("'' as input").select("'' as output");
  } else if (renderingProps.truncated) {
    queryBuilder
      .select(
        `leftUTF8(t.input, ${env.LANGFUSE_SERVER_SIDE_IO_CHAR_LIMIT}) as input`,
      )
      .select(
        `leftUTF8(t.output, ${env.LANGFUSE_SERVER_SIDE_IO_CHAR_LIMIT}) as output`,
      );
  } else {
    queryBuilder.selectColumns("t.input", "t.output");
  }

  queryBuilder.orderBy("ORDER BY t.timestamp DESC").limit(1);

  const { query, params } = queryBuilder.buildWithParams();

  const records = await queryClickhouse<TraceRecordReadType>({
    query,
    params,
    tags: { projectId },
    preferredClickhouseService: preferredClickhouseService ?? "EventsReadOnly",
  });

  const res = records.map((record) =>
    convertClickhouseToDomain(record, renderingProps),
  );

  res.forEach((trace) => {
    recordDistribution(
      "langfuse.query_by_id_age",
      new Date().getTime() - trace.timestamp.getTime(),
      {
        table: "events",
      },
    );
  });

  return res.shift();
};

/**
 * Routing wrapper for "trace by id" reads.
 *
 * If data is only written into the events tables, we look there and go to
 * traces otherwise.
 *
 * @deprecated Please prefer `getTraceByIdFromEventsTable` for new use-cases.
 * This should be exclusively used for backwards compatibility if the write mode
 * is events_only.
 */
export const getTraceById = async (
  params: Parameters<typeof getTraceByIdFromTracesTable>[0],
) => {
  if (env.LANGFUSE_MIGRATION_V4_WRITE_MODE !== "events_only") {
    return getTraceByIdFromTracesTable(params);
  }
  return getTraceByIdFromEventsTable(params);
};

const getLastTraceTimestampsByProjectsFromEventsTable = async ({
  projectIds,
}: {
  projectIds: string[];
}) => {
  if (projectIds.length === 0) return [];

  const query = `
    SELECT
      project_id,
      max(start_time) as last_trace_at
    FROM events_core
    WHERE project_id IN ({projectIds: Array(String)})
    AND start_time >= now() - INTERVAL 30 DAY
    AND is_deleted = 0
    GROUP BY project_id
  `;

  const rows = await queryClickhouse<{
    project_id: string;
    last_trace_at: string;
  }>({
    query,
    params: { projectIds },
    preferredClickhouseService: "EventsReadOnly",
  });

  return rows.map((row) => ({
    projectId: row.project_id,
    lastTraceAt: parseClickhouseUTCDateTimeFormat(row.last_trace_at),
  }));
};

/**
 * Routing wrapper for "last trace timestamp per project" reads.
 *
 * If data is only written into the events tables, we look there and go to the
 * legacy traces table otherwise.
 */
export const getLastTraceTimestampsByProjects = async (params: {
  projectIds: string[];
}) => {
  if (env.LANGFUSE_MIGRATION_V4_WRITE_MODE !== "events_only") {
    return getLastTraceTimestampsByProjectsFromTracesTable(params);
  }
  return getLastTraceTimestampsByProjectsFromEventsTable(params);
};
