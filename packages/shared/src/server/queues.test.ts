import { describe, it, expect } from "vitest";

import { IngestionEvent, OtelIngestionEvent } from "./queues";

describe("ingestion queue payload compatibility", () => {
  it("accepts ingestion jobs created before attribution fields existed", () => {
    const parsed = IngestionEvent.safeParse({
      data: {
        type: "trace-create",
        eventBodyId: "trace-01",
        fileKey: "event-01",
      },
      authCheck: {
        validKey: true,
        scope: {
          projectId: "project-01",
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts otel jobs with omitted attribution fields", () => {
    const parsed = OtelIngestionEvent.safeParse({
      data: {
        fileKey: "otel-01",
      },
      authCheck: {
        validKey: true,
        scope: {
          projectId: "project-01",
          accessLevel: "project",
        },
      },
    });

    expect(parsed.success).toBe(true);
  });
});
