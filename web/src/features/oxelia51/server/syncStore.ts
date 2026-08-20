/**
 * oxelia51 桌面账本云同步：/api/sync/* 三个路由共享的存储与鉴权。
 *
 * 数据落 web 的 PG（Langfuse 同库）`oxelia51` schema：
 * - synced_events：事件按 event_id 去重，seq 作增量同步游标；
 * - sync_tokens：长期同步密钥，库中只存 sha256，revoked_at 置位即吊销。
 *
 * 全部走参数化 $queryRaw/$executeRaw，禁止字符串拼接 SQL。
 */

import { Prisma } from "@oxelia51/shared/src/db";
import { z } from "zod";
import { toNumber } from "@/src/features/oxelia51/server/common";
import {
  countContentConflicts,
  generateSyncToken,
  hashSyncToken,
  type SyncedEventRow,
} from "@/src/features/oxelia51/server/syncTokenUtils";

/** 最小 raw-client 结构：全局 prisma 单例与 tRPC ctx.prisma 都满足（同 workspaceRouter 的写法）——本文件内部使用 */
type RawSqlClient = {
  $queryRaw: (
    q: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  $executeRaw: (
    q: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

/** download 单页上限（与桌面 sidecar 合约一致）——本文件内部使用，对外通过 uploadBodySchema 暴露 */
const SYNC_PAGE_SIZE = 2000;

// ---------- 鉴权 ----------

export type SyncAuth = { userId: string; tokenId: number };

/** 从 Authorization 头解析 Bearer token；缺头或格式不对返回 null */
export function parseBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/** 按 Bearer token 查 sync_tokens（仅未吊销），不命中返回 null；不做任何写操作 */
export async function resolveSyncToken(
  client: RawSqlClient,
  authorization: string | undefined,
): Promise<SyncAuth | null> {
  const token = parseBearerToken(authorization);
  if (!token) return null;
  const rows = (await client.$queryRaw`
    SELECT id, user_id FROM oxelia51.sync_tokens
    WHERE token_hash = ${hashSyncToken(token)} AND revoked_at IS NULL
    LIMIT 1
  `) as Array<{ id: unknown; user_id: string }>;
  const row = rows[0];
  if (!row) return null;
  return { userId: row.user_id, tokenId: toNumber(row.id) };
}

/** 命中密钥后的触点更新：last_used_at 刷新；device_label 为空时回填本设备 id（首登设备留痕） */
export async function touchSyncToken(
  client: RawSqlClient,
  tokenId: number,
  deviceId?: string,
): Promise<void> {
  if (deviceId) {
    await client.$executeRaw`
      UPDATE oxelia51.sync_tokens
      SET last_used_at = now(),
          device_label = CASE WHEN device_label = '' THEN ${deviceId} ELSE device_label END
      WHERE id = ${tokenId}
    `;
  } else {
    await client.$executeRaw`
      UPDATE oxelia51.sync_tokens SET last_used_at = now() WHERE id = ${tokenId}
    `;
  }
}

/** 签发同步密钥：返回明文（仅此一次），库中落 sha256 */
export async function issueSyncToken(
  client: RawSqlClient,
  userId: string,
): Promise<string> {
  const token = generateSyncToken();
  await client.$executeRaw`
    INSERT INTO oxelia51.sync_tokens (user_id, token_hash)
    VALUES (${userId}, ${hashSyncToken(token)})
  `;
  return token;
}

// ---------- upload ----------

// BIGINT 能装到 int64，但 JSON 入参是 JS number，以安全整数为界（超出即非法载荷）
const int64Field = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** 单条事件：eventId/deviceId/ts 必填，其余缺省按库 DEFAULT 口径（'' / 0）容忍补齐 */
const syncEventSchema = z.object({
  eventId: z.string().min(1),
  deviceId: z.string().min(1),
  projectId: z.string().default(""),
  sessionId: z.string().default(""),
  provider: z.string().default(""),
  agent: z.string().default(""),
  model: z.string().default(""),
  promptTokens: int64Field.default(0),
  completionTokens: int64Field.default(0),
  totalTokens: int64Field.default(0),
  cacheReadTokens: int64Field.default(0),
  cacheCreationTokens: int64Field.default(0),
  durationMs: int64Field.default(0),
  ts: z
    .string()
    .refine(
      (s) => !Number.isNaN(Date.parse(s)),
      "ts 必须是可解析的 RFC3339 时间",
    ),
});

export const uploadBodySchema = z.object({
  deviceId: z.string().min(1),
  events: z.array(syncEventSchema).min(1).max(SYNC_PAGE_SIZE),
});

export type SyncEventInput = z.infer<typeof syncEventSchema>;

export type InsertResult = { inserted: number; conflicts: number };

/**
 * 批量写入事件：event_id 冲突 DO NOTHING（幂等重传安全）。
 * 被跳过的行再与已有内容比对，不一致才计 conflicts（见 countContentConflicts）。
 * 参数化多行 VALUES：2000 条 × 13 列 = 26000 个绑定参数，低于 PG 65535 上限，无需分片。
 */
export async function insertSyncedEvents(
  client: RawSqlClient,
  userId: string,
  events: SyncEventInput[],
): Promise<InsertResult> {
  if (events.length === 0) return { inserted: 0, conflicts: 0 };

  const valueRows = events.map(
    (e) => Prisma.sql`(
      ${e.eventId}, ${userId}, ${e.deviceId}, ${e.projectId}, ${e.sessionId},
      ${e.provider}, ${e.agent}, ${e.model},
      ${e.promptTokens}, ${e.completionTokens}, ${e.totalTokens},
      ${e.cacheReadTokens}, ${e.cacheCreationTokens}, ${e.durationMs},
      ${new Date(e.ts)}
    )`,
  );
  const inserted = toNumber(
    await client.$executeRaw`
    INSERT INTO oxelia51.synced_events
      (event_id, user_id, device_id, project_id, session_id, provider, agent, model,
       prompt_tokens, completion_tokens, total_tokens, cache_read_tokens, cache_creation_tokens, duration_ms, ts)
    VALUES ${Prisma.join(valueRows)}
    ON CONFLICT (event_id) DO NOTHING
  `,
  );

  if (inserted === events.length) return { inserted, conflicts: 0 };

  // 有 event_id 被跳过：全量回查比对（刚插入的行必然与载荷一致，不影响计数）
  const existing = (await client.$queryRaw`
    SELECT event_id, provider, model, total_tokens, ts
    FROM oxelia51.synced_events
    WHERE event_id IN (${Prisma.join(events.map((e) => e.eventId))})
  `) as SyncedEventRow[];
  return { inserted, conflicts: countContentConflicts(events, existing) };
}

// ---------- download ----------

/** download 出参事件：camelCase，与桌面 sidecar 合约字段一一对应（不含 userId） */
export type SyncEventDto = {
  eventId: string;
  deviceId: string;
  projectId: string;
  sessionId: string;
  provider: string;
  agent: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  durationMs: number;
  ts: string; // RFC3339
};

type SyncedEventFullRow = {
  event_id: string;
  device_id: string;
  project_id: string;
  session_id: string;
  provider: string;
  agent: string;
  model: string;
  prompt_tokens: unknown;
  completion_tokens: unknown;
  total_tokens: unknown;
  cache_read_tokens: unknown;
  cache_creation_tokens: unknown;
  duration_ms: unknown;
  ts: Date | string;
  seq: unknown;
};

/** BIGINT/BIGSERIAL 经 $queryRaw 出来是 BigInt，JSON 序列化前统一转 Number（量级远小于 2^53） */
function toDto(row: SyncedEventFullRow): SyncEventDto {
  return {
    eventId: row.event_id,
    deviceId: row.device_id,
    projectId: row.project_id,
    sessionId: row.session_id,
    provider: row.provider,
    agent: row.agent,
    model: row.model,
    promptTokens: toNumber(row.prompt_tokens),
    completionTokens: toNumber(row.completion_tokens),
    totalTokens: toNumber(row.total_tokens),
    cacheReadTokens: toNumber(row.cache_read_tokens),
    cacheCreationTokens: toNumber(row.cache_creation_tokens),
    durationMs: toNumber(row.duration_ms),
    ts: new Date(row.ts).toISOString(),
  };
}

/**
 * 增量拉取：seq > after，按 seq 升序，排除本设备（空 deviceId 不排除），上限 SYNC_PAGE_SIZE。
 * nextCursor 取返回行最大 seq；无行则回显 after；hasMore = 恰好满页。
 */
export async function fetchEventsAfter(
  client: RawSqlClient,
  userId: string,
  after: number,
  deviceId?: string,
): Promise<{ events: SyncEventDto[]; nextCursor: number; hasMore: boolean }> {
  const excludeDeviceId = deviceId ?? "";
  const rows = (await client.$queryRaw`
    SELECT event_id, device_id, project_id, session_id, provider, agent, model,
           prompt_tokens, completion_tokens, total_tokens, cache_read_tokens, cache_creation_tokens, duration_ms, ts, seq
    FROM oxelia51.synced_events
    WHERE user_id = ${userId}
      AND seq > ${after}
      AND (${excludeDeviceId} = '' OR device_id <> ${excludeDeviceId})
    ORDER BY seq ASC
    LIMIT ${SYNC_PAGE_SIZE}
  `) as SyncedEventFullRow[];

  const lastSeq =
    rows.length > 0 ? toNumber(rows[rows.length - 1]?.seq) : after;
  return {
    events: rows.map(toDto),
    nextCursor: lastSeq,
    hasMore: rows.length === SYNC_PAGE_SIZE,
  };
}
