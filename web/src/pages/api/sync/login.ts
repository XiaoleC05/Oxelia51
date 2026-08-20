/**
 * POST /api/sync/login — 桌面端同步登录：注册邮箱 + 密码换长期同步密钥。
 *
 * 合约（与桌面 sidecar 对齐）：
 *   请求  { account, password }（account 为注册邮箱）
 *   200   { token, account }（token 明文仅此处下发一次）
 *   401   { error }（账户不存在 / 无密码 / 密码错误 统一文案，不泄露账户是否存在）
 *
 * 密码校验复用 credentials provider 同一 bcrypt 口径（verifyPassword）。
 * 限流依赖 nginx 层（与 /api/auth/signup 一致，应用层不重复实现）。
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@oxelia51/shared/src/db";
import { logger } from "@oxelia51/shared/src/server";
import { verifyPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { issueSyncToken } from "@/src/features/oxelia51/server/syncStore";

const bodySchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

const INVALID_CREDENTIALS = "账户或密码不正确";

/**
 * 防时序枚举的 dummy bcrypt hash（cost 12，与 hashPassword 同口径）。
 * 账户不存在 / SSO 无密码时也对它做一次 compare，拉平「账户存在与否」的响应时差，
 * 否则攻击者可用 50-100ms 的耗时差探测注册邮箱。比较结果必须丢弃。
 */
const DUMMY_PASSWORD_HASH =
  "$2a$12$DsvJs65pseusoRKEoggCFOj5buyDyTncfxnkGofNH0OcbJWP1IJRq";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(401).json({ error: INVALID_CREDENTIALS });
      return;
    }

    // Langfuse 注册邮箱一律小写存储（见 createUserEmailPassword）
    const email = parsed.data.account.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    // SSO 账户 password 为 null：按校验失败处理，与「账户不存在」同文案。
    // 账户不存在/无密码时也用 dummy hash 跑一次 compare 拉平时序（结果丢弃），
    // 避免「是否执行 bcrypt」泄露账户是否存在（时序枚举）。
    const passwordOk = await verifyPassword(
      parsed.data.password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || user.password == null || !passwordOk) {
      res.status(401).json({ error: INVALID_CREDENTIALS });
      return;
    }

    const token = await issueSyncToken(prisma, user.id);
    logger.info("oxelia51 sync login: token issued", { userId: user.id });
    res.status(200).json({ token, account: user.email ?? email });
  } catch (error) {
    logger.error("oxelia51 sync login failed", error);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
}
