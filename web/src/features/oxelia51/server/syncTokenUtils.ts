/** oxelia51 桌面账本云同步：纯函数（密钥生成/哈希、内容比对），不依赖 DB，便于单测。 */

import { createHash, randomBytes } from "node:crypto";

/** 同步密钥格式：oxs_ + 48 hex（24 字节随机数），与桌面 sidecar 的约定一致 */
const SYNC_TOKEN_PREFIX = "oxs_";
const SYNC_TOKEN_RANDOM_BYTES = 24;

/** 生成同步密钥明文。明文仅 login 时下发一次，库中只存 sha256。 */
export function generateSyncToken(): string {
  return (
    SYNC_TOKEN_PREFIX + randomBytes(SYNC_TOKEN_RANDOM_BYTES).toString("hex")
  );
}

/** sha256 hex：落库与按 token 查找都走哈希，明文不落库、不入日志。 */
export function hashSyncToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 上传事件里参与比对的字段（event_id 冲突时判断「同内容重传」还是「真冲突」） */
export type SyncEventPayload = {
  eventId: string;
  provider: string;
  model: string;
  totalTokens: number;
  ts: string;
};

/** 库中已有行（$queryRaw 原始命名），比对字段与 SyncEventPayload 一一对应 */
export type SyncedEventRow = {
  event_id: string;
  provider: string;
  model: string;
  total_tokens: unknown; // BIGINT → BigInt
  ts: unknown; // TIMESTAMPTZ → Date
};

const toTime = (v: unknown): number =>
  v instanceof Date ? v.getTime() : Date.parse(String(v));

/**
 * 比对上传事件与库中已有行：内容不一致计 1 个冲突。
 * 刚插入的行与载荷必然一致，所以重复 event_id 里只有「内容被改写过」的才计数。
 * 任一时间无法解析时按冲突计（宁多报不漏报）。
 */
export function countContentConflicts(
  events: SyncEventPayload[],
  existingRows: SyncedEventRow[],
): number {
  const byId = new Map(existingRows.map((r) => [r.event_id, r]));
  let conflicts = 0;
  for (const e of events) {
    const row = byId.get(e.eventId);
    if (!row) continue;
    const eventTs = Date.parse(e.ts);
    const rowTs = toTime(row.ts);
    const same =
      row.provider === e.provider &&
      row.model === e.model &&
      Number(row.total_tokens) === e.totalTokens &&
      !Number.isNaN(eventTs) &&
      !Number.isNaN(rowTs) &&
      rowTs === eventTs;
    if (!same) conflicts++;
  }
  return conflicts;
}
