"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { env } from "@/src/env.mjs";

type FilingInfoProps = {
  /** compact：备案单行（侧栏）；full：品牌 + 入口链接 + 备案三行（登录页/落地页/布局底部） */
  variant?: "compact" | "full";
};

/** Oxelia51 备案信息（全局页面底部，全站统一）。 */
export function FilingInfo({ variant = "compact" }: FilingInfoProps) {
  const basePath = env.NEXT_PUBLIC_BASE_PATH ?? "";
  const githubUrl = "https://github.com/XiaoleC05/Oxelia51";
  // 已登录时隐藏"登录/注册"入口；loading 期间按未登录渲染，避免落地页链接闪现后消失
  const { status } = useSession();
  const showAuthLinks = status !== "authenticated";

  const linkClass = "text-muted-foreground hover:text-foreground";

  return (
    <div
      className={
        variant === "compact"
          ? "text-muted-foreground flex flex-wrap items-center justify-center gap-x-1.5 text-[11px] leading-4 group-data-[collapsible=icon]:hidden"
          : "text-muted-foreground flex flex-col items-center gap-1.5 text-center text-xs leading-4 group-data-[collapsible=icon]:hidden"
      }
    >
      {variant === "full" && (
        <>
          {/* 行 1：品牌 */}
          <div className="flex flex-wrap items-center justify-center gap-x-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/icon-glyph-64.png`}
              alt="Oxelia51"
              width={16}
              height={16}
              className="dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/icon-glyph-64-dark.png`}
              alt="Oxelia51"
              width={16}
              height={16}
              className="hidden dark:block"
            />
            <span className="text-foreground font-bold">Oxelia51</span>
          </div>

          {/* 行 2：入口链接 */}
          <div className="flex flex-wrap items-center justify-center gap-x-1.5">
            <a
              href="https://oxelia51.com"
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              官网
            </a>
            <span>·</span>
            <Link href="/" className={linkClass}>
              快速上手
            </Link>
            {showAuthLinks && (
              <>
                <span>·</span>
                <Link href="/auth/sign-in" className={linkClass}>
                  登录
                </Link>
                <span>·</span>
                <Link href="/auth/sign-up" className={linkClass}>
                  注册
                </Link>
              </>
            )}
            <span>·</span>
            <a href="mailto:receive@oxelia51.com" className={linkClass}>
              用户反馈
            </a>
            <span>·</span>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              GitHub
            </a>
          </div>
        </>
      )}

      {/* 备案（full 为行 3） */}
      <div className="flex flex-wrap items-center justify-center gap-x-1.5">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          鲁ICP备2026038838号-1
        </a>
        <span>·</span>
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=37028202001309"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground flex items-center gap-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${basePath}/gongan.png`}
            alt=""
            width={variant === "compact" ? 10 : 12}
            height={variant === "compact" ? 10 : 12}
          />
          鲁公网安备37028202001309号
        </a>
      </div>
    </div>
  );
}
