import { OBSERVATIONS_TO_TRACE_INTERVAL } from "../../repositories/constants";
import { FilterList, StringFilter } from "./clickhouse-filter";

/**
 * Types for structured ORDER BY API
 */
export type OrderByDirection = "ASC" | "DESC";
export type OrderByEntry = { column: string; direction: OrderByDirection };
export type OrderByColumnsOptions = {
  eventTableAlias?: string;
  /**
   * Prepend `<alias>.project_id, toStartOfMinute(<alias>.start_time)` so the
   * sort matches the events table PRIMARY KEY (project_id,
   * toStartOfMinute(start_time), xxHash32(trace_id)) for read-in-order.
   * Callers should set this when the sort order leads with start_time.
   */
  matchTablePrimaryKey?: boolean;
};

const findStartTimeOrderClause = (
  entries: OrderByEntry[],
  eventTableAlias: string,
) =>
  entries.find(
    (e) => e.column.replace(/"/g, "") === `${eventTableAlias}.start_time`,
  );

const buildOrderByClause = (
  entries: OrderByEntry[],
  options: OrderByColumnsOptions = {},
) => {
  if (!entries.length) {
    return undefined;
  }

  const columns: string[] = [];
  const { eventTableAlias, matchTablePrimaryKey } = options;

  if (matchTablePrimaryKey && eventTableAlias) {
    // The prefix reuses the direction the caller chose for start_time so the
    // combined order stays equivalent (toStartOfMinute is monotone).
    const direction =
      findStartTimeOrderClause(entries, eventTableAlias)?.direction ?? "DESC";
    columns.push(
      `${eventTableAlias}.project_id ${direction}`,
      `toStartOfMinute(${eventTableAlias}.start_time) ${direction}`,
    );
  }

  columns.push(...entries.map((e) => `${e.column} ${e.direction}`));

  return `ORDER BY ${columns.join(", ")}`;
};

/**
 * Aggregation fields for trace-level queries
 * These fields use ClickHouse aggregation functions and require GROUP BY
 */
const EVENTS_AGGREGATION_FIELDS = {
  // Grouping keys (must be in GROUP BY)
  id: "trace_id AS id",
  projectId: "project_id",

  // Aggregated fields
  name: "argMaxIf(trace_name, event_ts, trace_name <> '') AS name",
  timestamp: "min(start_time) as timestamp",
  environment:
    "argMaxIf(environment, event_ts, environment <> '') AS environment",
  version: "argMaxIf(version, event_ts, version <> '') AS version",
  session_id: "argMaxIf(session_id, event_ts, session_id <> '') AS session_id",
  user_id: "argMaxIf(user_id, event_ts, user_id <> '') AS user_id",
  input: "argMaxIf(input, event_ts, parent_span_id = '') AS input",
  output: "argMaxIf(output, event_ts, parent_span_id = '') AS output",
  // Note: events_core/events_full tables don't have input_truncated/output_truncated columns.
  // Truncation is handled by the materialized view for events_core, or by leftUTF8() at query time.
  metadata:
    "argMaxIf(mapFromArrays(arrayReverse(e.metadata_names), arrayReverse(e.metadata_values)), event_ts, parent_span_id = '') AS metadata",
  created_at: "min(created_at) AS created_at",
  updated_at: "max(updated_at) AS updated_at",
  total_cost: "sum(total_cost) AS total_cost",
  latency_milliseconds:
    "date_diff('millisecond', min(start_time), greatest(max(start_time), max(end_time))) AS latency_milliseconds",
  observation_ids:
    "groupUniqArrayIf(span_id, span_id <> '') AS observation_ids",
  observation_count:
    "length(groupUniqArrayIf(span_id, span_id <> '' AND span_id <> concat('t-', trace_id))) AS observation_count",

  bookmarked:
    "argMaxIf(bookmarked, event_ts, parent_span_id = '') AS bookmarked",
  public: "max(public) AS public",
  experiment_item_id:
    "argMaxIf(experiment_item_id, event_ts, experiment_item_id <> '') AS experiment_item_id",

  // Observation-level aggregations for filtering support
  usage_details: "sumMap(usage_details) as usage_details",
  cost_details: "sumMap(cost_details) as cost_details",
  aggregated_level:
    "multiIf(arrayExists(x -> x = 'ERROR', groupArray(level)), 'ERROR', arrayExists(x -> x = 'WARNING', groupArray(level)), 'WARNING', arrayExists(x -> x = 'DEFAULT', groupArray(level)), 'DEFAULT', 'DEBUG') AS aggregated_level",
  warning_count: "countIf(level = 'WARNING') as warning_count",
  error_count: "countIf(level = 'ERROR') as error_count",
  default_count: "countIf(level = 'DEFAULT') as default_count",
  debug_count: "countIf(level = 'DEBUG') as debug_count",

  tags: "argMaxIf(tags, event_ts, notEmpty(tags)) AS tags",
  release: "argMaxIf(release, event_ts, release <> '') AS release",

  // experiment fields
  experiment_id: "any(experiment_id) as experiment_id",
} as const;

/**
 * Field sets for aggregation queries
 */
const AGGREGATION_FIELD_SETS = {
  all: Object.keys(EVENTS_AGGREGATION_FIELDS) as Array<
    keyof typeof EVENTS_AGGREGATION_FIELDS
  >,
} as const;

/**
 * Special symbol to explicitly opt-out of automatic project_id filtering
 *
 * @example
 * // Use when you need to query across all projects (use with caution!)
 * const builder = new EventsQueryBuilder({ projectId: NoProjectId });
 */
export const NoProjectId = Symbol("NoProjectId");
export type NoProjectIdType = typeof NoProjectId;

/**
 * Most abstract base class - contains common query building logic
 * that applies to all query types (WHERE, ORDER BY, LIMIT, params management).
 */
abstract class AbstractQueryBuilder {
  protected whereClauses: string[] = [];
  protected havingClauses: string[] = [];
  protected orderByClause = "";
  protected limitByClause = "";
  protected limitClause = "";
  protected params: Record<string, any> = {};

  /**
   * Add raw WHERE condition with optional parameters
   * Use ClickHouse parameter syntax: {paramName: Type}
   *
   * Example:
   *   .whereRaw("span_id = {id: String}", { id: "abc123" })
   */
  whereRaw(condition: string, params?: Record<string, any>): this {
    if (condition.trim()) {
      this.whereClauses.push(condition);
    }
    if (params) {
      this.params = { ...this.params, ...params };
    }
    return this;
  }

  /**
   * Add WHERE conditions from FilterList
   * Strips leading AND/OR and wraps in parentheses
   */
  where(condition: { query: string; params?: Record<string, any> }): this {
    if (condition.query.trim()) {
      const trimmedQuery = condition.query.trim().replace(/^(AND|OR)\s+/i, "");
      this.whereRaw(`(${trimmedQuery})`, condition.params);
    }
    return this;
  }

  /**
   * Apply filters from a FilterList.
   * Subclasses can override to add optimizations (e.g., partition pruning).
   */
  applyFilters(filterList: FilterList): this {
    this.where(filterList.apply());
    return this;
  }

  /**
   * Add raw HAVING condition with optional parameters.
   * Use for post-aggregation filtering in GROUP BY queries.
   */
  havingRaw(condition: string, params?: Record<string, any>): this {
    if (condition.trim()) {
      this.havingClauses.push(condition);
    }
    if (params) {
      this.params = { ...this.params, ...params };
    }
    return this;
  }

  /**
   * Add HAVING conditions from FilterList.
   * Strips leading AND/OR and wraps in parentheses.
   */
  having(condition: { query: string; params?: Record<string, any> }): this {
    if (condition.query.trim()) {
      const trimmedQuery = condition.query.trim().replace(/^(AND|OR)\s+/i, "");
      this.havingRaw(`(${trimmedQuery})`, condition.params);
    }
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(clause: string): this {
    if (clause.trim()) {
      this.orderByClause = clause;
    }
    return this;
  }

  /**
   * Add ORDER BY using OrderByEntry array for structured API
   */
  orderByColumns(
    entries: OrderByEntry[],
    options?: OrderByColumnsOptions,
  ): this {
    const orderByClause = buildOrderByClause(entries, options);
    if (orderByClause) {
      this.orderByClause = orderByClause;
    }
    return this;
  }

  /**
   * Add LIMIT and OFFSET
   */
  limit(limit?: number, offset?: number): this {
    if (limit !== undefined && offset !== undefined && offset > 0) {
      this.limitClause = "LIMIT {limit: Int32} OFFSET {offset: Int32}";
      this.params.limit = limit;
      this.params.offset = offset;
    } else if (limit !== undefined) {
      this.limitClause = "LIMIT {limit: Int32}";
      this.params.limit = limit;
    } else {
      this.limitClause = "";
    }
    return this;
  }

  /**
   * Add LIMIT 1 BY for ClickHouse deduplication
   * This is applied before the regular LIMIT clause
   *
   * @param columns - Columns to deduplicate by
   * @example
   *   .limitBy("e.span_id", "e.project_id")
   */
  limitBy(...columns: string[]): this {
    if (columns.length > 0) {
      this.limitByClause = `LIMIT 1 BY ${columns.join(", ")}`;
    }

    return this;
  }

  /**
   * Conditionally apply builder operations
   */
  when<T extends AbstractQueryBuilder>(
    this: T,
    condition: boolean,

    fn: (builder: T) => T,
  ): T {
    return condition ? fn(this) : this;
  }

  /**
   * Build the final query string along with accumulated parameters
   */
  buildWithParams(): { query: string; params: Record<string, any> } {
    return {
      query: this.buildQuery(),
      params: this.params,
    };
  }

  /**
   * Helper to build LIMIT section (includes LIMIT BY if set)
   */
  protected buildLimitSection(): string {
    const parts: string[] = [];

    if (this.limitByClause) {
      parts.push(this.limitByClause);
    }
    if (this.limitClause) {
      parts.push(this.limitClause);
    }

    return parts.join("\n");
  }

  /**
   * Helper to build HAVING section
   */
  protected buildHavingSection(): string {
    if (this.havingClauses.length === 0) return "";
    return `HAVING ${this.havingClauses.join("\n  AND ")}`;
  }

  /**
   * Build the final query string - implemented by subclasses
   */
  protected abstract buildQuery(): string;
}

/**
 * Adds CTE and JOIN support to the abstract query builder
 */
abstract class AbstractCTEQueryBuilder extends AbstractQueryBuilder {
  protected ctes: string[] = [];
  protected joins: string[] = [];

  /**
   * Add a CTE (Common Table Expression) to the query
   */
  withCTE(
    name: string,
    queryWithParams: { query: string; params: Record<string, any> },
  ): this {
    this.ctes.push(`${name} AS (${queryWithParams.query})`);
    this.params = { ...this.params, ...queryWithParams.params };
    return this;
  }

  /**
   * Add a JOIN of the specified kind
   */
  private join(kind: "LEFT" | "INNER", table: string, onClause: string): this {
    this.joins.push(`${kind} JOIN ${table} ${onClause}`);
    return this;
  }

  /**
   * Add a LEFT JOIN
   */
  leftJoin(table: string, onClause: string): this {
    this.join("LEFT", table, onClause);
    return this;
  }

  /**
   * Add an INNER JOIN
   */
  innerJoin(table: string, onClause: string): this {
    this.join("INNER", table, onClause);
    return this;
  }

  /**
   * Helper to build WITH clause section
   */
  protected buildCTESection(): string {
    return this.ctes.length > 0 ? `WITH ${this.ctes.join(",\n")}` : "";
  }

  /**
   * Helper to build JOIN section
   */
  protected buildJoinSection(): string {
    return this.joins.length > 0 ? this.joins.join("\n") : "";
  }

  /**
   * Helper to build WHERE section
   */
  protected buildWhereSection(): string {
    if (this.whereClauses.length === 0) return "";
    return `WHERE ${this.whereClauses.join("\n  AND ")}`;
  }
}

/**
 * Base class for events table query builders.
 * Contains shared logic for building SQL queries against the events table.
 */
abstract class BaseEventsQueryBuilder<
  TFields extends Record<string, string>,
> extends AbstractCTEQueryBuilder {
  protected selectFields: Set<string> = new Set();
  protected projectId: string | NoProjectIdType;

  constructor(
    protected fields: TFields,
    options: { projectId: string | NoProjectIdType },
  ) {
    super();
    this.projectId = options.projectId;
  }

  /**
   * Set ORDER BY clause. When the sort order includes e.start_time, the
   * PRIMARY KEY prefix (project_id, toStartOfMinute(start_time)) is prepended
   * for optimal ClickHouse performance.
   *
   * @example
   * builder.orderByColumns([
   *   { column: "e.start_time", direction: "DESC" },
   *   { column: "e.event_ts", direction: "DESC" },
   * ])
   * // Produces: ORDER BY e.project_id DESC, toStartOfMinute(e.start_time) DESC, e.start_time DESC, e.event_ts DESC
   */
  orderByColumns(entries: OrderByEntry[]): this {
    const orderByClause = buildOrderByClause(entries, {
      eventTableAlias: "e",
      matchTablePrimaryKey: Boolean(findStartTimeOrderClause(entries, "e")),
    });
    if (orderByClause) {
      this.orderByClause = orderByClause;
    }
    return this;
  }

  /**
   * Apply default ORDER BY for events table queries.
   * Uses start_time DESC (project_id is auto-prepended).
   */
  orderByDefault(): this {
    return this.orderByColumns([{ column: "e.start_time", direction: "DESC" }]);
  }

  /**
   * Apply filters with automatic query optimizations.
   * Adds xxHash32 optimization for trace_id equality filters.
   */
  override applyFilters(filterList: FilterList): this {
    const traceIdFilter = filterList.find(
      (f) =>
        f.clickhouseTable.startsWith("events") &&
        f.field === 'e."trace_id"' &&
        f.operator === "=",
    );
    if (traceIdFilter instanceof StringFilter) {
      this.whereRaw("xxHash32(trace_id) = xxHash32({traceIdXxHash: String})", {
        traceIdXxHash: traceIdFilter.value,
      });
    }
    super.applyFilters(filterList);
    return this;
  }

  /**
   * Build the SELECT clause - implemented by subclasses
   */
  protected abstract buildSelectClause(): string;

  /**
   * Build the GROUP BY clause - implemented by subclasses
   * Returns empty string for non-aggregation queries
   */
  protected abstract buildGroupByClause(): string;

  /**
   * Get the table name to query from.
   * Subclasses can override to implement dynamic table selection.
   * Default: events_core (lightweight table with truncated I/O)
   */
  protected getTableName(): string {
    return "events_core";
  }

  /**
   * Build the final query string
   */
  protected buildQuery(): string {
    const parts: string[] = [];

    // CTEs (WITH clause)
    const cteSection = this.buildCTESection();
    if (cteSection) {
      parts.push(cteSection);
    }

    // SELECT
    parts.push(this.buildSelectClause());

    // FROM - choose table based on data requirements
    const tableName = this.getTableName();
    parts.push(`FROM ${tableName} e`);

    // JOINs
    const joinSection = this.buildJoinSection();
    if (joinSection) {
      parts.push(joinSection);
    }

    // WHERE - add project_id filter automatically
    const allWhereClauses = [...this.whereClauses];
    if (this.projectId !== NoProjectId) {
      allWhereClauses.unshift("e.project_id = {projectId: String}");
      this.params.projectId = this.projectId;
    }

    if (allWhereClauses.length > 0) {
      parts.push(`WHERE ${allWhereClauses.join("\n  AND ")}`);
    }

    // GROUP BY (only for aggregation queries)
    const groupBy = this.buildGroupByClause();
    if (groupBy) {
      parts.push(groupBy);
    }

    // HAVING (only for aggregation queries with post-agg filters)
    const havingSection = this.buildHavingSection();
    if (havingSection) {
      parts.push(havingSection);
    }

    // ORDER BY
    if (this.orderByClause) {
      parts.push(this.orderByClause);
    }

    // LIMIT
    const limitSection = this.buildLimitSection();
    if (limitSection) {
      parts.push(limitSection);
    }

    return parts.join("\n");
  }
}

/**
 * Schema describing what columns a CTE exposes
 */
export type CTESchema = string[];

/**
 * A CTE with its query, params, and exposed column names
 */
export interface CTEWithSchema {
  query: string;
  params: Record<string, any>;
  schema: CTESchema;
}

/**
 * Utility type to generate all valid column references from alias mappings.
 * For each alias, generates all possible column references like "alias.columnName".
 *
 * @example
 * type CTEs = { traces: ['id', 'name'], scores: ['trace_id', 'score'] }
 * type Aliases = { t: 'traces', s: 'scores' }
 * type Cols = AliasedColumns<CTEs, Aliases>
 * // Result: "t.id" | "t.name" | "s.trace_id" | "s.score"
 */
type AliasedColumns<
  RegisteredCTEs extends Record<string, string[]>,
  Aliases extends Record<string, keyof RegisteredCTEs>,
> = {
  [Alias in keyof Aliases]: `${Alias & string}.${RegisteredCTEs[Aliases[Alias]][number]}`;
}[keyof Aliases];

/**
 * EventsAggregationQueryBuilder - A fluent query builder for aggregated events table queries
 *
 * This builder is specifically for aggregation queries (e.g., building traces from events).
 * It automatically includes GROUP BY trace_id, project_id and uses aggregation functions.
 *
 * @example
 * const builder = new EventsAggregationQueryBuilder({ projectId: "my-project-id" })
 *   .selectFieldSet("all")
 *   .withStartTimeFrom(startTimeFrom)
 *   .orderBy("ORDER BY timestamp DESC");
 *
 * const { query, params } = builder.buildWithParams();
 */
export class EventsAggregationQueryBuilder extends BaseEventsQueryBuilder<
  typeof EVENTS_AGGREGATION_FIELDS
> {
  private truncated = true;

  constructor(options: { projectId: string }) {
    super(EVENTS_AGGREGATION_FIELDS, options);
  }

  /**
   * Set whether to use truncated I/O (events_core) or full I/O (events_full).
   * Default is true (truncated).
   */
  withTruncated(truncated: boolean): this {
    this.truncated = truncated;
    return this;
  }

  /**
   * Get table name based on truncated setting.
   * Uses events_full when full I/O is needed (truncated = false).
   */
  protected override getTableName(): string {
    return this.truncated ? "events_core" : "events_full";
  }

  /**
   * Add SELECT fields from predefined aggregation field sets
   */
  selectFieldSet(
    ...setNames: Array<keyof typeof AGGREGATION_FIELD_SETS>
  ): this {
    setNames
      .flatMap((s) => AGGREGATION_FIELD_SETS[s])
      .forEach((field) => this.selectFields.add(field));
    return this;
  }

  /**
   * Add trace ID filter
   */
  withTraceIds(traceIds?: string[]): this {
    return this.when(Boolean(traceIds && traceIds.length > 0), (b) =>
      b.whereRaw("trace_id IN ({traceIds: Array(String)})", { traceIds }),
    );
  }

  /**
   * Add start time filter with OBSERVATIONS_TO_TRACE_INTERVAL
   */
  withStartTimeFrom(startTimeFrom?: string | null): this {
    return this.when(Boolean(startTimeFrom), (b) =>
      b.whereRaw(
        `start_time >= {startTimeFrom: DateTime64(3)} - ${OBSERVATIONS_TO_TRACE_INTERVAL}`,
        { startTimeFrom },
      ),
    );
  }

  /**
   * Build the SELECT clause for aggregation queries
   */
  protected buildSelectClause(): string {
    const fieldExpressions = [...this.selectFields]
      .map((key) => {
        return this.fields[key as keyof typeof EVENTS_AGGREGATION_FIELDS];
      })
      .filter(Boolean);
    return `SELECT\n  ${fieldExpressions.join(",\n  ")}`;
  }

  /**
   * Build the GROUP BY clause for trace aggregations
   */
  protected buildGroupByClause(): string {
    return "GROUP BY trace_id, project_id";
  }

  /**
   * Build with schema for use in CTEQueryBuilder.
   * Returns query, params, and list of column names this CTE exposes.
   */
  buildWithSchema(): CTEWithSchema {
    // Extract column names from selected fields
    const schema = [...this.selectFields].map((fieldKey) => {
      return fieldKey;
    });

    return {
      ...this.buildWithParams(),
      schema,
    };
  }
}

/**
 * Query builder that composes CTEs with type-safe CTE name tracking.
 *
 * Generic type parameters:
 * - RegisteredCTEs: Maps CTE names to their column name arrays
 * - Aliases: Maps table aliases to CTE names
 *
 * @example
 * const builder = new CTEQueryBuilder()
 *   .withCTE('traces', { query: '...', params: {}, schema: ['id', 'name'] })
 *   .withCTE('scores', { query: '...', params: {}, schema: ['trace_id', 'score'] })
 *   .from('traces', 't')                              // Type-safe, adds 't' -> 'traces' mapping
 *   .leftJoin('scores', 's', 'ON s.trace_id = t.id')  // Type-safe, adds 's' -> 'scores' mapping
 *   .selectColumns('t.id', 't.name', 's.score')       // Type-safe column references
 *   .select('COUNT(*) as total')                      // Raw SQL expression
 *   .from('nonexistent', 'x');                        // Compile error - CTE not registered
 */
export class CTEQueryBuilder<
  RegisteredCTEs extends Record<string, CTESchema> = {},
  Aliases extends Record<string, keyof RegisteredCTEs> = {},
> extends AbstractQueryBuilder {
  private ctes: string[] = [];
  private cteSchemas: Map<string, CTESchema> = new Map();
  private joins: string[] = [];
  private selectExpressions: string[] = [];
  private fromClause = "";
  private fromAlias = "";
  private groupByClause = "";

  /**
   * Register a CTE with its schema
   * Returns a new builder type with the CTE name added to RegisteredCTEs.
   */
  withCTE<Name extends string, Schema extends CTESchema>(
    name: Name,
    cteWithSchema: CTEWithSchema & { schema: Schema },
  ): CTEQueryBuilder<RegisteredCTEs & Record<Name, Schema>, Aliases> {
    this.ctes.push(`${name} AS (${cteWithSchema.query})`);
    this.params = { ...this.params, ...cteWithSchema.params };
    this.cteSchemas.set(name, cteWithSchema.schema);
    // Type assertion needed because we're changing the type parameter
    return this as any;
  }

  /**
   * Convenience method to add a CTE from a builder with buildWithSchema()
   */
  withCTEFromBuilder<Name extends string>(
    name: Name,
    builder: { buildWithSchema(): CTEWithSchema },
  ): CTEQueryBuilder<
    RegisteredCTEs &
      Record<Name, ReturnType<typeof builder.buildWithSchema>["schema"]>,
    Aliases
  > {
    return this.withCTE(name, builder.buildWithSchema());
  }

  /**
   * Set the main FROM clause.
   * Only accepts CTE names that have been registered via withCTE().
   */
  from<Name extends keyof RegisteredCTEs & string, Alias extends string>(
    cteName: Name,
    alias: Alias,
  ): CTEQueryBuilder<RegisteredCTEs, Aliases & Record<Alias, Name>> {
    if (!this.cteSchemas.has(cteName)) {
      throw new Error(
        `CTE '${cteName}' not registered. Call withCTE('${cteName}', ...) first.`,
      );
    }
    this.fromClause = cteName;
    this.fromAlias = alias;
    // Type assertion needed because we're changing the type parameter
    return this as any;
  }

  /**
   * Add a JOIN of the specified kind.
   * Only accepts CTE names that have been registered via withCTE().
   */
  private join<
    Name extends keyof RegisteredCTEs & string,
    Alias extends string,
  >(
    kind: "LEFT" | "LEFT ANY" | "INNER",
    cteName: Name,
    alias: Alias,
    onClause: string,
  ): CTEQueryBuilder<RegisteredCTEs, Aliases & Record<Alias, Name>> {
    if (!this.cteSchemas.has(cteName)) {
      throw new Error(
        `CTE '${cteName}' not registered. Call withCTE('${cteName}', ...) first.`,
      );
    }
    this.joins.push(`${kind} JOIN ${cteName} ${alias} ${onClause}`);
    // Type assertion needed because we're changing the type parameter
    return this as any;
  }

  /**
   * Join another CTE.
   * Only accepts CTE names that have been registered via withCTE().
   */
  leftJoin<Name extends keyof RegisteredCTEs & string, Alias extends string>(
    cteName: Name,
    alias: Alias,
    onClause: string,
  ): CTEQueryBuilder<RegisteredCTEs, Aliases & Record<Alias, Name>> {
    this.join("LEFT", cteName, alias, onClause);
    return this as any;
  }

  /**
   * LEFT ANY join another CTE. `ANY` takes exactly one matching row from the
   * right side, avoiding the row fan-out a plain LEFT JOIN produces when the
   * right side has un-merged ReplacingMergeTree duplicates.
   * Only accepts CTE names that have been registered via withCTE().
   */
  leftAnyJoin<Name extends keyof RegisteredCTEs & string, Alias extends string>(
    cteName: Name,
    alias: Alias,
    onClause: string,
  ): CTEQueryBuilder<RegisteredCTEs, Aliases & Record<Alias, Name>> {
    this.join("LEFT ANY", cteName, alias, onClause);
    return this as any;
  }

  /**
   * Inner join another CTE.
   * Only accepts CTE names that have been registered via withCTE().
   */
  innerJoin<Name extends keyof RegisteredCTEs & string, Alias extends string>(
    cteName: Name,
    alias: Alias,
    onClause: string,
  ): CTEQueryBuilder<RegisteredCTEs, Aliases & Record<Alias, Name>> {
    this.join("INNER", cteName, alias, onClause);
    return this as any;
  }

  /**
   * Add type-safe column references from registered CTEs.
   * Only accepts column references in the format "alias.columnName" where:
   * - alias is a registered table alias (from from() or leftJoin())
   * - columnName exists in that CTE's schema
   *
   * @example
   * builder
   *   .from('traces', 't')
   *   .leftJoin('scores', 's', 'ON s.trace_id = t.id')
   *   .selectColumns('t.id', 't.name', 's.score') // Type-safe
   *   .selectColumns('t.nonexistent')             // Compile error
   *   .selectColumns('x.id')                      // Compile error - 'x' not registered
   */
  selectColumns(
    ...columns: Array<AliasedColumns<RegisteredCTEs, Aliases>>
  ): this {
    this.selectExpressions.push(...columns);
    return this;
  }

  /**
   * Add raw SELECT expressions (for complex SQL, aggregations, aliases, etc.)
   * Not type-checked - use for expressions like "COUNT(*) as total" or "t.id || '-' || s.score as combined"
   * For type-safe column selection, use selectColumns() instead.
   *
   * @example
   * builder.select("COUNT(*) as total", "t.id || '-' || s.score as combined")
   */
  select(...expressions: string[]): this {
    this.selectExpressions.push(...expressions);
    return this;
  }

  /**
   * Add GROUP BY clause
   *
   * @example
   * builder.groupBy("t.project_id", "t.experiment_id")
   */
  groupBy(...columns: Array<AliasedColumns<RegisteredCTEs, Aliases>>): this {
    if (columns.length > 0) {
      this.groupByClause = columns.join(", ");
    }
    return this;
  }

  /**
   * Build the query
   */
  protected buildQuery(): string {
    if (!this.fromClause) {
      throw new Error(
        "No FROM clause set. Call from() to specify the main CTE.",
      );
    }
    if (this.selectExpressions.length === 0) {
      throw new Error("No SELECT expressions. Call select() to add columns.");
    }

    const parts: string[] = [];

    // CTEs
    if (this.ctes.length > 0) {
      parts.push(`WITH ${this.ctes.join(",\n")}`);
    }

    // SELECT
    parts.push(`SELECT\n  ${this.selectExpressions.join(",\n  ")}`);

    // FROM
    parts.push(`FROM ${this.fromClause} ${this.fromAlias}`);

    // JOINs
    if (this.joins.length > 0) {
      parts.push(this.joins.join("\n"));
    }

    // WHERE
    if (this.whereClauses.length > 0) {
      parts.push(`WHERE ${this.whereClauses.join("\n  AND ")}`);
    }

    // GROUP BY
    if (this.groupByClause) {
      parts.push(`GROUP BY ${this.groupByClause}`);
    }

    // HAVING
    const havingSection = this.buildHavingSection();
    if (havingSection) {
      parts.push(havingSection);
    }

    // ORDER BY
    if (this.orderByClause) {
      parts.push(this.orderByClause);
    }

    // LIMIT
    const limitSection = this.buildLimitSection();
    if (limitSection) {
      parts.push(limitSection);
    }

    return parts.join("\n");
  }
}
