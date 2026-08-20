/**
 * submitFeedback 按客户端 IP 的内存滑窗限流：同 IP 每小时 ≤ 5 条。
 *
 * 为什么不用 Langfuse 现成的 RateLimitService：它按 orgId + 云套餐计费口径限流，
 * 面向已鉴权的公开 API，且 self-host 部署默认关闭；匿名反馈没有 org 维度，复用不上。
 *
 * 口径说明（取舍）：内存实现仅对单个 Node 进程生效，多实例部署下限额按实例数放大；
 * 本部署为单容器（nginx → 单个 web :3000），单机口径足够。与邮箱限流叠加使用，
 * 防「换邮箱绕过」的匿名滥发。
 */

/** 窗口长度：1 小时 */
const WINDOW_MS = 60 * 60 * 1000;
/** 窗口内同 IP 最大提交数 */
const MAX_PER_WINDOW = 5;

/** ip → 窗口内提交时间戳（升序） */
const hits = new Map<string, number[]>();

/**
 * 判定并记录一次提交：窗口内未超上限返回 true 并计入本次；超限返回 false（不计入）。
 * now 可注入便于测试。
 */
export function allowFeedbackFromIp(
  ip: string,
  now: number = Date.now(),
): boolean {
  // 无 IP（如直连无 nginx 的异常部署）不按 IP 限，邮箱限流仍兜底
  if (!ip) return true;

  const cutoff = now - WINDOW_MS;
  const list = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list); // 顺带回写清理后的列表，防止 Map 只增不减
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  return true;
}

/** 清空全部计数（仅测试用；测试文件通过 vitest 直接 import 本模块） */
export function resetFeedbackIpRateLimit(): void {
  hits.clear();
}
