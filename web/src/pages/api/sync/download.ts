/**
 * GET /api/sync/download — 桌面端增量拉取其它设备已同步的账本事件。
 *
 * 合约（与桌面 sidecar 对齐）：
 *   请求头 Authorization: Bearer <token>
 *   参数  after=<seq:int>（缺省 0）、deviceId=<id>（可空；非空时排除本设备事件）
 *   200   { ok: true, events: [...], nextCursor, hasMore }
 *         events 按 seq 升序、上限 2000，字段与 upload 一致（不含 userId）
 *   401   { error }（密钥缺失/无效/已吊销）；400 { error }（after 非法）
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@oxelia51/shared/src/db";
import { logger } from "@oxelia51/shared/src/server";
import {
  fetchEventsAfter,
  resolveSyncToken,
  touchSyncToken,
} from "@/src/features/oxelia51/server/syncStore";

/** query 取值：Next 对重复参数给 string[]，只取第一个 */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const auth = await resolveSyncToken(prisma, req.headers.authorization);
    if (!auth) {
      res.status(401).json({ error: "同步密钥无效或已断开" });
      return;
    }

    const afterRaw = firstParam(req.query.after);
    const after =
      afterRaw === undefined || afterRaw === "" ? 0 : Number(afterRaw);
    if (!Number.isSafeInteger(after) || after < 0) {
      res.status(400).json({ error: "after 必须是非负整数" });
      return;
    }
    const deviceId = firstParam(req.query.deviceId) || undefined;

    await touchSyncToken(prisma, auth.tokenId, deviceId);
    const result = await fetchEventsAfter(prisma, auth.userId, after, deviceId);
    res.status(200).json({
      ok: true,
      events: result.events,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    logger.error("oxelia51 sync download failed", error);
    res.status(500).json({ error: "拉取失败，请稍后重试" });
  }
}
