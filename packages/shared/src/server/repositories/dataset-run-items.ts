// Slim restoration after the Langfuse tracing-domain convergence: keeps only
// the dataset run item count aggregation used by the retained telemetry job.
import { convertDateToClickhouseDateTime } from "../clickhouse/client";
import { queryClickhouse } from "./clickhouse";

export const getDatasetRunItemCountsByProjectInCreationInterval = async ({
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
  FROM dataset_run_items_rmt
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
  });

  return rows.map((row) => ({
    projectId: row.project_id,
    count: Number(row.count),
  }));
};
