import Head from "next/head";
import { ArrowRight, Code, MessageSquare, Users } from "lucide-react";
import { SiGithub } from "react-icons/si";
import type { ReactNode } from "react";
import { Button } from "@/src/components/ui/button";
import { SiteHeader } from "@/src/features/oxelia51/components/site/SiteHeader";
import { SiteFooter } from "@/src/features/oxelia51/components/site/SiteFooter";
import { CommunityStats } from "@/src/features/oxelia51/components/landing/CommunityStats";
import { Reveal } from "@/src/features/oxelia51/components/landing/Reveal";

/**
 * Oxelia51 独立社区页（/community）：开源共建。
 * 展示 GitHub 真实数据（Star/Fork/贡献者）+ 参与方式三入口 + GitHub CTA。
 * 字体与首页/文档一致（正文 text-sm / 次要 text-xs）。skipAppLayout，全匿名可访问。
 */
const GITHUB_URL = "https://github.com/XiaoleC05/Oxelia51";

const PARTICIPATE: {
  icon: ReactNode;
  title: string;
  desc: string;
  href: string;
}[] = [
  {
    icon: <Code className="h-4 w-4" />,
    title: "贡献代码",
    desc: "Fork 仓库、提 Pull Request，一起把它打磨得更好。",
    href: GITHUB_URL,
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    title: "提需求 / 报问题",
    desc: "遇到的问题、想要的功能，通过 Issues 或站内反馈告诉我们。",
    href: `${GITHUB_URL}/issues`,
  },
  {
    icon: <Users className="h-4 w-4" />,
    title: "讨论交流",
    desc: "分享用法与心得，写信给我们：receive@oxelia51.com。",
    href: "mailto:receive@oxelia51.com",
  },
];

export default function CommunityPage() {
  return (
    <>
      <Head>
        <title>社区 · Oxelia51</title>
        <meta
          name="description"
          content="Oxelia51 开源社区：贡献代码、提需求、参与共建。MIT 许可证，欢迎每个人参与。"
        />
      </Head>
      <div className="ox-site-page flex min-h-screen flex-col">
        <SiteHeader />
        <main className="grow">
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <div className="text-center">
                <span className="text-xs font-bold tracking-widest text-(--ox-accent) uppercase">
                  社区
                </span>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-(--ox-text-h) sm:text-4xl">
                  开源 · 共建
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-(--ox-text-muted)">
                  Oxelia51 以 MIT 许可证开源，欢迎每个人参与。
                </p>
              </div>
            </Reveal>

            {/* GitHub 真实数据 */}
            <Reveal delay={80}>
              <div className="mt-10">
                <CommunityStats />
              </div>
            </Reveal>

            {/* 参与方式 */}
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {PARTICIPATE.map((p, i) => (
                <Reveal key={p.title} delay={i * 100}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex h-full flex-col gap-3 rounded-xl border p-5 transition-colors hover:border-(--ox-accent)/50"
                    style={{ borderColor: "var(--ox-border)" }}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-(--ox-accent)"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--ox-accent) 10%, transparent)",
                      }}
                    >
                      {p.icon}
                    </span>
                    <h2 className="text-sm font-bold text-(--ox-text-h)">
                      {p.title}
                    </h2>
                    <p className="text-xs leading-5 text-(--ox-text-muted)">
                      {p.desc}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs text-(--ox-accent) opacity-0 transition-opacity group-hover:opacity-100">
                      前往 <ArrowRight className="h-3 w-3" />
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>

            <Reveal delay={150}>
              <div className="mt-10 text-center">
                <Button asChild variant="outline">
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                    <SiGithub className="mr-2 h-4 w-4" />
                    前往 GitHub
                  </a>
                </Button>
              </div>
            </Reveal>
          </section>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

CommunityPage.skipAppLayout = true;
