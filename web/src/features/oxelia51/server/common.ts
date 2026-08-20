/** oxelia51 服务端共享小工具。 */

/** 容错转数字：null/undefined → 0（数据库聚合字段常为 null）。 */
export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};
