import Head from "next/head";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { SiteHeader } from "@/src/features/oxelia51/components/site/SiteHeader";
import { SiteFooter } from "@/src/features/oxelia51/components/site/SiteFooter";
import { Reveal } from "@/src/features/oxelia51/components/landing/Reveal";
import { DownloadCard } from "@/src/features/oxelia51/components/download/DownloadCard";

/**
 * Oxelia51 独立下载页（/download）。
 * 桌面应用发布后从 GitHub v* Release 动态拉取真实下载链接；
 * 尚无版本时显示「即将推出」；云平台现可用。
 * skipAppLayout 绕过应用外壳，全匿名可访问；顶栏「免费下载」与 Hero 徽章跳转至此。
 */

export default function DownloadPage() {
  return (
    <>
      <Head>
        <title>免费下载 · Oxelia51</title>
        <meta
          name="description"
          content="下载 Oxelia51 桌面应用（Windows / macOS / Linux）——本地优先的个人 Token 记账本，自动记录供应商与 Agent 的消耗。"
        />
      </Head>
      <div className="ox-site-page flex min-h-screen flex-col">
        <SiteHeader />
        <main className="grow">
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            {/* Hero：黑白红 + 品牌红强调 */}
            <Reveal>
              <div className="text-center">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                  style={{
                    borderColor: "var(--ox-accent-border)",
                    color: "var(--ox-accent)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-(--ox-accent)" />
                  本地优先 · 自动记账
                </span>
                <h1 className="mx-auto mt-5 max-w-3xl text-xl leading-tight font-bold tracking-tight text-(--ox-text-h) sm:text-3xl sm:whitespace-nowrap lg:text-4xl">
                  下载桌面应用，Token 消耗
                  <span className="text-(--ox-accent)">一目了然</span>
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-(--ox-text-muted)">
                  改一行环境变量，自动记录供应商与 Agent 的消耗。 支持 Windows /
                  macOS / Linux，数据全部保存在本地。
                </p>
                <div className="mt-6 flex items-center justify-center gap-3 text-xs text-(--ox-text-muted)">
                  <span
                    className="rounded-full border px-2.5 py-1"
                    style={{ borderColor: "var(--ox-border)" }}
                  >
                    无需登录
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1"
                    style={{ borderColor: "var(--ox-border)" }}
                  >
                    本地存储
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1"
                    style={{ borderColor: "var(--ox-border)" }}
                  >
                    MIT 开源
                  </span>
                </div>
              </div>
            </Reveal>

            {/* 平台下载卡片（动态拉取真实发布） */}
            <DownloadCard />

            {/* 三步接入说明 */}
            <Reveal delay={120}>
              <div
                className="mt-10 grid gap-3 rounded-xl border p-6 sm:grid-cols-3"
                style={{
                  borderColor: "var(--ox-border)",
                  backgroundColor: "var(--ox-bg-alt)",
                }}
              >
                {[
                  {
                    n: "1",
                    t: "安装并打开",
                    d: "启动桌面应用，本地代理自动监听 17800。",
                  },
                  {
                    n: "2",
                    t: "选择供应商复制地址",
                    d: "首页「快速接入」搜索供应商，复制代理地址。",
                  },
                  {
                    n: "3",
                    t: "指向 Base URL",
                    d: "把模型工具的 Base URL 指向本地代理，自动落账。",
                  },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: "var(--ox-accent)" }}
                    >
                      {s.n}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-(--ox-text-h)">
                        {s.t}
                      </h3>
                      <p className="mt-0.5 text-xs leading-5 text-(--ox-text-muted)">
                        {s.d}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* 云平台说明 */}
            <Reveal delay={180}>
              <div
                className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border p-6 sm:flex-row"
                style={{
                  borderColor: "var(--ox-border)",
                  backgroundColor: "var(--ox-bg-alt)",
                }}
              >
                <div>
                  <h3 className="text-sm font-bold text-(--ox-text-h)">
                    云平台：查看已同步数据
                  </h3>
                  <p className="mt-1 text-xs text-(--ox-text-muted)">
                    桌面端登录账户后，本地账本可同步到云端，用于备份与跨设备恢复。云平台负责数据查看，日常记账仍在桌面端本地完成。
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/docs/cloud">
                    了解云平台
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Reveal>
          </section>
        </main>
        <SiteFooter />

        {/* 平台卡片锚点高亮（顶栏/首页徽章跳转后闪烁提示） */}
        <style>{`
          #windows:target,
          #macos:target,
          #linux:target {
            border-color: var(--ox-accent) !important;
            animation: oxTargetFlash 1.6s ease-out;
          }
          @keyframes oxTargetFlash {
            0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ox-accent) 45%, transparent); }
            100% { box-shadow: 0 0 0 14px transparent; }
          }
          @media (prefers-reduced-motion: reduce) {
            #windows:target,
            #macos:target,
            #linux:target {
              animation: none;
            }
          }
        `}</style>
      </div>
    </>
  );
}

DownloadPage.skipAppLayout = true;
