import { env } from "../../env";
import {
  clickhouseClient,
  PreferredClickhouseService,
} from "../clickhouse/client";
import { logger } from "../logger";
import { instrumentAsync } from "../instrumentation";
import { NodeClickHouseClientConfigOptions } from "@clickhouse/client/dist/config";
import { type Span, SpanKind } from "@opentelemetry/api";
import { backOff } from "exponential-backoff";
import { ClickHouseSettings, type DataFormat } from "@clickhouse/client";
import { RESOURCE_LIMIT_ERROR_MESSAGE } from "../../errors/errorMessages";
import {
  normalizeClickHouseQueryTags,
  type ClickHouseQueryTags,
  type NormalizedClickHouseQueryTags,
} from "../clickhouse/queryTags";

/**
 * Custom error class for ClickHouse resource-related errors
 */
// Error type configuration map
const ERROR_TYPE_CONFIG: Record<
  "MEMORY_LIMIT" | "OVERCOMMIT" | "TIMEOUT",
  {
    discriminators: string[];
  }
> = {
  MEMORY_LIMIT: {
    discriminators: ["memory limit exceeded"],
  },
  OVERCOMMIT: {
    discriminators: ["OvercommitTracker"],
  },
  TIMEOUT: {
    discriminators: ["Timeout", "timeout", "timed out"],
  },
};

type ErrorType = keyof typeof ERROR_TYPE_CONFIG;

export class ClickHouseResourceError extends Error {
  static ERROR_ADVICE_MESSAGE = RESOURCE_LIMIT_ERROR_MESSAGE;

  public readonly errorType: ErrorType;
  public readonly tags?: NormalizedClickHouseQueryTags;

  constructor(
    errType: ErrorType,
    originalError: Error,
    tags?: NormalizedClickHouseQueryTags,
  ) {
    super(originalError.message, { cause: originalError });
    this.name = "ClickHouseResourceError";
    this.errorType = errType;
    this.tags = tags;
    // Preserve the original stack trace if available
    if (originalError.stack) {
      this.stack = originalError.stack;
    }
  }

  static wrapIfResourceError(
    originalError: Error,
    tags?: NormalizedClickHouseQueryTags,
  ): Error {
    const errorMessage = originalError.message || "";

    for (const [type, config] of Object.entries(ERROR_TYPE_CONFIG) as Array<
      [
        keyof typeof ERROR_TYPE_CONFIG,
        (typeof ERROR_TYPE_CONFIG)[keyof typeof ERROR_TYPE_CONFIG],
      ]
    >) {
      const hasDiscriminator = config.discriminators.some((discriminator) =>
        errorMessage.includes(discriminator),
      );

      if (hasDiscriminator) {
        return new ClickHouseResourceError(type, originalError, tags);
      }
    }

    return originalError;
  }
}

/**
 * Guard against reads from the legacy 'events' table.
 * Reads must use events_core or events_full instead.
 * Matches "FROM events" or "JOIN events" as a standalone table name
 * (not events_core, events_full, or CTE aliases like filtered_events).
 */
const LEGACY_EVENTS_TABLE_PATTERN = /\b(?:from|join)\s+events\b(?!_)/i;

function assertNoLegacyEventsRead(query: string): void {
  if (LEGACY_EVENTS_TABLE_PATTERN.test(query)) {
    throw new Error(
      `Reading from legacy 'events' table is forbidden. Use events_core or events_full. Query: ${query.slice(0, 200)}`,
    );
  }
}

/**
 * ClickHouse has a quirk when it comes to handling exceptions mid response.
 * It will simply output a row with "exception" key inside, which is indistinguishable from
 * a query like `SELECT "my lovely string" AS exception;` may return.
 *
 * E.g.:
 * ```
 * {"exception":"Code: 395. DB::Exception: memory limit exceeded: would use l0.23 GiB"}
 * ```
 *
 * This function makes the best effort to convert such rows into errors and throws them.
 *
 * See:
 * - https://github.com/ClickHouse/clickhouse-js/issues/332
 * - https://github.com/ClickHouse/ClickHouse/issues/75175
 *
 * Ideally this should get fixed in the future versions of ClickHouse.
 */
function handleExceptionRow<T>(parsedRow: T): T {
  if (
    typeof parsedRow === "object" &&
    parsedRow !== null &&
    Object.keys(parsedRow).length === 1 &&
    "exception" in parsedRow
  ) {
    const potentialException = (parsedRow as { exception: string }).exception;
    if (potentialException.match(/^Code: (\d+)/)) {
      logger.error(
        `[clickhouse] Exception row detected: ${potentialException}`,
        parsedRow,
      );
      throw new Error(potentialException);
    }
  }
  return parsedRow;
}

export type ClickhouseQueryOpts = {
  query: string;
  params?: Record<string, unknown>;
  useMultipartParamsAuto?: boolean;
  clickhouseConfigs?: NodeClickHouseClientConfigOptions;
  tags?: ClickHouseQueryTags;
  preferredClickhouseService?: PreferredClickhouseService;
  clickhouseSettings?: ClickHouseSettings;
  allowLegacyEventsRead?: boolean;
};

function recordSummaryOnSpan(
  span: Span,
  responseHeaders: Record<string, string | string[] | undefined>,
): void {
  const summaryHeader = responseHeaders["x-clickhouse-summary"];
  if (!summaryHeader) return;
  try {
    const summary = Array.isArray(summaryHeader)
      ? JSON.parse(summaryHeader[0])
      : JSON.parse(summaryHeader);
    for (const key in summary) {
      span.setAttribute(`ch.${key}`, summary[key]);
    }
  } catch (error) {
    logger.debug(
      `Failed to parse clickhouse summary header ${summaryHeader}`,
      error,
    );
  }
}

function setSpanQueryAttributes(span: Span, query: string): void {
  span.setAttribute("ch.query.text", query);
  span.setAttribute("db.system", "clickhouse");
  span.setAttribute("db.query.text", query);
  span.setAttribute("db.operation.name", "SELECT");
}

async function sendClickhouseQuery<F extends DataFormat>(opts: {
  query: string;
  params?: Record<string, unknown>;
  useMultipartParamsAuto?: boolean;
  clickhouseConfigs?: NodeClickHouseClientConfigOptions;
  tags?: ClickHouseQueryTags;
  preferredClickhouseService?: PreferredClickhouseService;
  clickhouseSettings?: ClickHouseSettings;
  format: F;
  span: Span;
  queryId?: string;
}) {
  const normalizedTags = normalizeClickHouseQueryTags(opts.tags);
  const res = await clickhouseClient(
    opts.clickhouseConfigs,
    opts.preferredClickhouseService,
  ).query({
    query: opts.query,
    format: opts.format,
    query_params: opts.params,
    use_multipart_params_auto: opts.useMultipartParamsAuto,
    ...(opts.queryId ? { query_id: opts.queryId } : {}),
    clickhouse_settings: {
      ...opts.clickhouseSettings,
      log_comment: JSON.stringify(normalizedTags),
    },
  });

  if (env.NODE_ENV === "development") {
    logger.info(`clickhouse:query ${res.query_id} ${opts.query}`);
  }

  opts.span.setAttribute("ch.queryId", res.query_id);
  for (const [key, value] of Object.entries(normalizedTags)) {
    opts.span.setAttribute(`ch.tag.${key}`, value);
  }
  recordSummaryOnSpan(opts.span, res.response_headers);

  return res;
}

/**
 * Determines if an error is retryable (socket hang up, connection reset, broken pipe, etc.)
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errorMessage = (error as Error).message?.toLowerCase() || "";

  // Check for socket hang up and other network-related errors
  const retryablePatterns = [
    "socket hang up",
    "broken pipe",
    "connection reset",
    "econnreset",
    "network_error",
    "etimedout",
    "econnrefused",
  ];

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
}

export async function queryClickhouse<T>(
  opts: ClickhouseQueryOpts,
): Promise<T[]> {
  if (!opts.allowLegacyEventsRead) assertNoLegacyEventsRead(opts.query);
  const normalizedTags = normalizeClickHouseQueryTags(opts.tags);
  return await instrumentAsync(
    { name: "clickhouse-query", spanKind: SpanKind.CLIENT },
    async (span) => {
      setSpanQueryAttributes(span, opts.query);

      return await backOff(
        async () => {
          const res = await sendClickhouseQuery({
            ...opts,
            clickhouseSettings: {
              asterisk_include_alias_columns: 1,
              asterisk_include_materialized_columns: 1,
              ...opts.clickhouseSettings,
            },
            format: "JSONEachRow",
            span,
          });
          return (await res.json<T>()).map(handleExceptionRow);
        },
        {
          numOfAttempts: env.LANGFUSE_CLICKHOUSE_QUERY_MAX_ATTEMPTS,
          retry: (error: Error, attemptNumber: number) => {
            const shouldRetry = isRetryableError(error);
            if (shouldRetry) {
              logger.warn(
                `ClickHouse query failed with retryable error (attempt ${attemptNumber}/${env.LANGFUSE_CLICKHOUSE_QUERY_MAX_ATTEMPTS}): ${error.message}`,
                {
                  error: error.message,
                  attemptNumber,
                  tags: normalizedTags,
                },
              );
              span.addEvent("clickhouse-query-retry", {
                "retry.attempt": attemptNumber,
                "retry.error": error.message,
              });
            } else {
              logger.error(
                `ClickHouse query failed with non-retryable error: ${error.message}`,
                {
                  error: error.message,
                  tags: normalizedTags,
                },
              );
            }
            return shouldRetry;
          },
          startingDelay: 100,
          timeMultiple: 1,
          maxDelay: 100,
        },
      ).catch((error) => {
        throw ClickHouseResourceError.wrapIfResourceError(
          error as Error,
          normalizedTags,
        );
      });
    },
  );
}

export async function commandClickhouse(opts: {
  query: string;
  params?: Record<string, unknown> | undefined;
  clickhouseConfigs?: NodeClickHouseClientConfigOptions;
  tags?: ClickHouseQueryTags;
  queryId?: string;
  clickhouseSettings?: ClickHouseSettings;
  abortSignal?: AbortSignal;
  session_id?: string;
}): Promise<void> {
  return await instrumentAsync(
    { name: "clickhouse-command", spanKind: SpanKind.CLIENT },
    async (span) => {
      // https://opentelemetry.io/docs/specs/semconv/database/database-spans/
      span.setAttribute("ch.query.text", opts.query);
      span.setAttribute("db.system", "clickhouse");
      span.setAttribute("db.query.text", opts.query);
      span.setAttribute("db.operation.name", "COMMAND");
      const normalizedTags = normalizeClickHouseQueryTags(opts.tags);

      const res = await clickhouseClient(opts.clickhouseConfigs).command({
        query: opts.query,
        query_params: opts.params,
        ...(opts.session_id ? { session_id: opts.session_id } : {}),
        ...(opts.queryId ? { query_id: opts.queryId } : {}),
        ...(opts.abortSignal ? { abort_signal: opts.abortSignal } : {}),
        clickhouse_settings: {
          ...opts.clickhouseSettings,
          log_comment: JSON.stringify(normalizedTags),
        },
      });
      // same logic as for prisma. we want to see queries in development
      if (env.NODE_ENV === "development") {
        logger.info(`clickhouse:query ${res.query_id} ${opts.query}`);
      }

      span.setAttribute("ch.queryId", res.query_id);
      for (const [key, value] of Object.entries(normalizedTags)) {
        span.setAttribute(`ch.tag.${key}`, value);
      }

      // add summary headers to the span. Helps to tune performance
      const summaryHeader = res.response_headers["x-clickhouse-summary"];
      if (summaryHeader) {
        try {
          const summary = Array.isArray(summaryHeader)
            ? JSON.parse(summaryHeader[0])
            : JSON.parse(summaryHeader);
          for (const key in summary) {
            span.setAttribute(`ch.${key}`, summary[key]);
          }
        } catch (error) {
          logger.debug(
            `Failed to parse clickhouse summary header ${summaryHeader}`,
            error,
          );
        }
      }
    },
  );
}

export function parseClickhouseUTCDateTimeFormat(dateStr: string): Date {
  return new Date(`${dateStr.replace(" ", "T")}Z`);
}

export function clickhouseCompliantRandomCharacters() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  const randomArray = new Uint8Array(5);
  crypto.getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}
