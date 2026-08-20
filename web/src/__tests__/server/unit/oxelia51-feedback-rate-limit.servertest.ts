import { describe, expect, it, beforeEach } from "vitest";

import {
  allowFeedbackFromIp,
  resetFeedbackIpRateLimit,
} from "@/src/features/oxelia51/server/feedbackRateLimit";

describe("allowFeedbackFromIp（同 IP 每小时 ≤ 5 条滑窗）", () => {
  beforeEach(() => resetFeedbackIpRateLimit());

  it("窗口内前 5 次放行，第 6 次拒绝", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(allowFeedbackFromIp("1.2.3.4", now)).toBe(true);
    }
    expect(allowFeedbackFromIp("1.2.3.4", now)).toBe(false);
  });

  it("不同 IP 互不影响", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) allowFeedbackFromIp("1.2.3.4", now);
    expect(allowFeedbackFromIp("5.6.7.8", now)).toBe(true);
  });

  it("窗口滑动后恢复放行", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) allowFeedbackFromIp("1.2.3.4", t0);
    expect(allowFeedbackFromIp("1.2.3.4", t0)).toBe(false);
    // 1 小时 + 1ms 后旧记录滑出窗口
    expect(allowFeedbackFromIp("1.2.3.4", t0 + 60 * 60 * 1000 + 1)).toBe(true);
  });

  it("空 IP 不按 IP 限流（邮箱限流兜底）", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(allowFeedbackFromIp("", now)).toBe(true);
    }
  });
});
