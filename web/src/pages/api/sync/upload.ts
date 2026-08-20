/**
 * POST /api/sync/upload — 桌面端批量上传账本事件。
 *
 * 合约（与桌面 sidecar 对齐）：
 *   请求头 Authorization: Bearer <token>
 *   请求  { deviceId, events: [...] }（events ≤ 2000 条，ts 为 RFC3339）
 *   200   { ok: true, inserted, conflicts }
 *   401   { error }（密钥缺失/无效/已吊销）；400 { error }（载荷非法）
 *
 * event_id 主键去重（ON CONFLICT DO NOTHING），重复上传幂等安全；
 * 被跳过的行再比对内容，不一致计入 conflicts。
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@oxelia51/shared/src/db";
import { logger } from "@oxelia51/shared/src/server";
import {
  insertSyncedEvents,
  resolveSyncToken,
  touchSyncToken,
  uploadBodySchema,
} from "@/src/features/oxelia51/server/syncStore";

// 2000 条事件约 0.5–1MB，默认 1mb 上限留一倍余量
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const auth = await resolveSyncToken(prisma, req.headers.authorization);
    if (!auth) {
      res.status(401).json({ error: "同步密钥无效或已断开" });
      return;
    }

    const parsed = uploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "请求格式不正确" });
      return;
    }

    const { deviceId, events } = parsed.data;
    await touchSyncToken(prisma, auth.tokenId, deviceId);
    const result = await insertSyncedEvents(prisma, auth.userId, events);
    res.status(200).json({
      ok: true,
      inserted: result.inserted,
      conflicts: result.conflicts,
    });
  } catch (error) {
    logger.error("oxelia51 sync upload failed", error);
    res.status(500).json({ error: "上传失败，请稍后重试" });
  }
}
