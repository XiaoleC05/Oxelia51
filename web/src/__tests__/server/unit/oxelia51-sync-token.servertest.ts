import { describe, expect, it } from "vitest";

import {
  countContentConflicts,
  generateSyncToken,
  hashSyncToken,
} from "@/src/features/oxelia51/server/syncTokenUtils";

describe("generateSyncToken", () => {
  it("生成 oxs_ + 48 hex 的密钥（与桌面 sidecar 合约一致）", () => {
    expect(generateSyncToken()).toMatch(/^oxs_[0-9a-f]{48}$/);
  });

  it("两次生成不相同", () => {
    expect(generateSyncToken()).not.toBe(generateSyncToken());
  });
});

describe("hashSyncToken", () => {
  it("输出 64 位 sha256 hex", () => {
    expect(hashSyncToken(generateSyncToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("与已知 sha256 向量一致（落库/查找同口径）", () => {
    // echo -n "test" | sha256sum
    expect(hashSyncToken("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });
});

describe("countContentConflicts", () => {
  const event = {
    eventId: "evt-1",
    provider: "openai",
    model: "gpt-5",
    totalTokens: 123,
    ts: "2026-08-10T12:00:00.000Z",
  };
  const matchingRow = {
    event_id: "evt-1",
    provider: "openai",
    model: "gpt-5",
    total_tokens: BigInt(123), // BIGINT 经 $queryRaw 出来是 BigInt
    ts: new Date("2026-08-10T12:00:00.000Z"),
  };

  it("内容一致（含 BigInt/Date 归一化）不计冲突", () => {
    expect(countContentConflicts([event], [matchingRow])).toBe(0);
  });

  it("provider/model/total_tokens/ts 任一不一致计 1 个冲突", () => {
    expect(
      countContentConflicts([event], [{ ...matchingRow, model: "gpt-4o" }]),
    ).toBe(1);
    expect(
      countContentConflicts(
        [event],
        [{ ...matchingRow, total_tokens: BigInt(124) }],
      ),
    ).toBe(1);
    expect(
      countContentConflicts(
        [event],
        [{ ...matchingRow, ts: new Date("2026-08-10T13:00:00.000Z") }],
      ),
    ).toBe(1);
    expect(
      countContentConflicts(
        [event],
        [{ ...matchingRow, provider: "anthropic" }],
      ),
    ).toBe(1);
  });

  it("库中无对应行不计冲突；多条混合按条累计", () => {
    expect(countContentConflicts([event], [])).toBe(0);
    const other = { ...event, eventId: "evt-2" };
    const rows = [
      matchingRow,
      { ...matchingRow, event_id: "evt-2", total_tokens: BigInt(999) },
    ];
    expect(countContentConflicts([event, other], rows)).toBe(1);
  });

  it("时间无法解析时按冲突计", () => {
    expect(
      countContentConflicts([event], [{ ...matchingRow, ts: "not-a-date" }]),
    ).toBe(1);
  });
});
