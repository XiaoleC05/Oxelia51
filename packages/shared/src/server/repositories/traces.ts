import {
  parseClickhouseUTCDateTimeFormat,
  queryClickhouse,
} from "./clickhouse";
import { TraceRecordReadType } from "./definitions";
import { convertClickhouseToDomain } from "./traces_converters";
import {
  convertDateToClickhouseDateTime,
  PreferredClickhouseService,
} from "../clickhouse/client";
import { recordDistribution } from "../instrumentation";
import { DEFAULT_RENDERING_PROPS, RenderingProps } from "../utils/rendering";
import { env } from "../../env";

export const getTraceCountsByProjectInCreationInterval = async ({
  start,
  end,
}: {
  start: Date;
  end: Date;
}) => {
  const query = `
    SELECT
      project_id,
      count(*) as count
    FROM traces
    WHERE created_at >= {start: DateTime64(3)}
    AND created_at < {end: DateTime64(3)}
    GROUP BY project_id
  `;

  const rows = await queryClickhouse<{ project_id: string; count: string }>({
    query,
    params: {
      start: convertDateToClickhouseDateTime(start),
      end: convertDateToClickhouseDateTime(end),
    },
    clickhouseConfigs: {
      request_timeout: 300000, // 5 minutes timeout
    },
  });

  return rows.map((row) => ({
    projectId: row.project_id,
    count: Number(row.count),
  }));
};

export const getLastTraceTimestampsByProjectsFromTracesTable = async ({
  projectIds,
}: {
  projectIds: string[];
}) => {
  if (projectIds.length === 0) return [];

  const query = `
    SELECT
      project_id,
      max(timestamp) as last_trace_at
    FROM traces
    WHERE project_id IN ({projectIds: Array(String)})
    AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY project_id
  `;

  const rows = await queryClickhouse<{
    project_id: string;
    last_trace_at: string;
  }>({
    query,
    params: { projectIds },
    preferredClickhouseService: "ReadOnly",
  });

  return rows.map((row) => ({
    projectId: row.project_id,
    lastTraceAt: parseClickhouseUTCDateTimeFormat(row.last_trace_at),
  }));
};

/**
 * Retrieves a trace record by its ID and associated project ID from the legacy
 * `traces` table.
 *
 * Prefer the routing wrapper `getTraceById` (in repositories/events.ts) for
 * application reads: it dispatches between this legacy reader and the events
 * table based on the V4 migration flags. Call this directly only when you
 * specifically need the legacy table (e.g. backfills, migration tooling).
 */
export const getTraceByIdFromTracesTable = async ({
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
  const input = {
    params: {
      traceId,
      projectId,
      ...(timestamp
        ? { timestamp: convertDateToClickhouseDateTime(timestamp) }
        : {}),
      ...(fromTimestamp
        ? { fromTimestamp: convertDateToClickhouseDateTime(fromTimestamp) }
        : {}),
    },
    tags: { projectId },
  };

  const inputColumn = excludeInputOutput
    ? "''"
    : renderingProps.truncated
      ? `leftUTF8(input, ${env.LANGFUSE_SERVER_SIDE_IO_CHAR_LIMIT})`
      : "input";
  const outputColumn = excludeInputOutput
    ? "''"
    : renderingProps.truncated
      ? `leftUTF8(output, ${env.LANGFUSE_SERVER_SIDE_IO_CHAR_LIMIT})`
      : "output";
  // map() (not a '{}' string literal) so the excluded column keeps the
  // Map type and converts to an empty object in the domain model.
  const metadataColumn = excludeMetadata ? "map()" : "metadata";

  const query = `
    SELECT
      id,
      name as name,
      user_id as user_id,
      ${metadataColumn} as metadata,
      release as release,
      version as version,
      project_id,
      environment,
      public as public,
      bookmarked as bookmarked,
      tags,
      ${inputColumn} as input,
      ${outputColumn} as output,
      session_id as session_id,
      0 as is_deleted,
      timestamp,
      created_at,
      updated_at
    FROM traces
    WHERE id = {traceId: String}
    AND project_id = {projectId: String}
    ${timestamp ? `AND toDate(timestamp) = toDate({timestamp: DateTime64(3)})` : ""}
    ${fromTimestamp ? `AND timestamp >= {fromTimestamp: DateTime64(3)}` : ""}
    ORDER BY event_ts DESC
    LIMIT 1
  `;

  const records = await queryClickhouse<TraceRecordReadType>({
    query,
    params: input.params,
    tags: input.tags,
    preferredClickhouseService,
  });

  const res = records.map((record) =>
    convertClickhouseToDomain(record, renderingProps),
  );

  res.forEach((trace) => {
    recordDistribution(
      "langfuse.query_by_id_age",
      new Date().getTime() - trace.timestamp.getTime(),
      {
        table: "traces",
      },
    );
  });

  return res.shift();
};
