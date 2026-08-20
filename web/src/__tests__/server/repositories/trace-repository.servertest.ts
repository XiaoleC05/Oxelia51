import {
  getTraceById,
  getTraceByIdFromTracesTable,
} from "@oxelia51/shared/src/server";
import { v4 } from "uuid";
import { createTrace } from "@oxelia51/shared/src/server/test-utils";
import { createTracesCh } from "@oxelia51/shared/src/server/test-utils";

const projectId = "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a";

describe("Clickhouse Traces Repository Test", () => {
  it("should throw if no traces are found", async () => {
    expect(
      await getTraceById({ traceId: v4(), projectId: v4() }),
    ).toBeUndefined();
  });

  it("should return a trace if it exists", async () => {
    const traceId = v4();

    const trace = createTrace({
      id: traceId,
      project_id: projectId,
      session_id: v4(),
      timestamp: Date.now(),
      metadata: {},
      public: false,
      bookmarked: false,
      name: "Test Trace",
      tags: [],
      release: null,
      version: null,
      user_id: null,
      input: JSON.stringify({
        this: {
          is: {
            a: ["complex", "object"],
          },
        },
      }),
      output: "regular string",
      created_at: Date.now(),
      updated_at: Date.now(),
      event_ts: Date.now(),
      is_deleted: 0,
    });

    await createTracesCh([trace]);

    const result = await getTraceById({
      traceId,
      projectId,
      timestamp: new Date(trace.timestamp),
    });
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    expect(result.id).toEqual(trace.id);
    expect(result.projectId).toEqual(trace.project_id);
    expect(result.name).toEqual(trace.name);
    expect(result.timestamp).toEqual(new Date(trace.timestamp));
    expect(result.tags).toEqual(trace.tags);
    expect(result.bookmarked).toEqual(trace.bookmarked);
    expect(result.release).toEqual(trace.release);
    expect(result.version).toEqual(trace.version);
    expect(result.userId).toEqual(trace.user_id);
    expect(result.sessionId).toEqual(trace.session_id);
    expect(result.public).toEqual(trace.public);
    expect(result.input).toEqual(JSON.parse(trace.input ?? "{}"));
    expect(result.output).toEqual("regular string");
    expect(result.metadata).toEqual(trace.metadata);
    expect(result.createdAt.getTime()).toBeCloseTo(
      new Date(trace.created_at).getTime(),
      -2, // Up to 50ms precision
    );
    expect(result.updatedAt.getTime()).toBeCloseTo(
      new Date(trace.updated_at).getTime(),
      -2, // Up to 50ms precision
    );
  });

  it("should find a trace if no timestamp is provided", async () => {
    const traceId = v4();

    const trace = createTrace({
      id: traceId,
      project_id: projectId,
      session_id: v4(),
      timestamp: Date.now(),
      metadata: {},
      public: false,
      bookmarked: false,
      name: "Test Trace",
      tags: [],
      release: null,
      version: null,
      user_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      event_ts: Date.now(),
      is_deleted: 0,
    });

    await createTracesCh([trace]);

    const result = await getTraceById({ traceId, projectId });
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    expect(result.id).toEqual(trace.id);
    expect(result.projectId).toEqual(trace.project_id);
    expect(result.name).toEqual(trace.name);
    expect(result.timestamp).toEqual(new Date(trace.timestamp));
    expect(result.tags).toEqual(trace.tags);
    expect(result.bookmarked).toEqual(trace.bookmarked);
    expect(result.release).toEqual(trace.release);
    expect(result.version).toEqual(trace.version);
    expect(result.userId).toEqual(trace.user_id);
    expect(result.sessionId).toEqual(trace.session_id);
    expect(result.public).toEqual(trace.public);
    expect(result.input).toEqual(null);
    expect(result.output).toEqual(null);
    expect(result.metadata).toEqual(trace.metadata);
    expect(result.createdAt.getTime()).toBeCloseTo(
      new Date(trace.created_at).getTime(),
      -2, // Up to 50ms precision
    );
    expect(result.updatedAt.getTime()).toBeCloseTo(
      new Date(trace.updated_at).getTime(),
      -2, // Up to 50ms precision
    );
  });

  it("should return empty metadata and IO when excluded from the fetch", async () => {
    const traceId = v4();

    const trace = createTrace({
      id: traceId,
      project_id: projectId,
      metadata: { key: "value" },
      input: "some input",
      output: "some output",
      timestamp: Date.now(),
    });

    await createTracesCh([trace]);

    const result = await getTraceByIdFromTracesTable({
      traceId,
      projectId,
      timestamp: new Date(trace.timestamp),
      excludeInputOutput: true,
      excludeMetadata: true,
    });
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    expect(result.id).toEqual(trace.id);
    expect(result.metadata).toEqual({});
    expect(result.input).toBeNull();
    expect(result.output).toBeNull();
  });
});
