"use client";

import Head from "next/head";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  ChevronDown,
  Code,
  Download,
  FolderKanban,
  Monitor,
  ShieldCheck,
  Terminal,
  Apple,
} from "lucide-react";
import { SiGithub } from "react-icons/si";
import { Button } from "@/src/components/ui/button";
import { CopyCodeBlock } from "@/src/features/oxelia51/components/landing/CopyCodeBlock";
import { DashboardMock } from "@/src/features/oxelia51/components/landing/DashboardMock";
import { SiteHeader } from "@/src/features/oxelia51/components/site/SiteHeader";
import { SiteFooter } from "@/src/features/oxelia51/components/site/SiteFooter";
import { Reveal } from "@/src/features/oxelia51/components/landing/Reveal";
import { BackToTop } from "@/src/features/oxelia51/components/landing/BackToTop";
import {
  LANDING_FAQ,
  LANDING_HERO,
  type FaqItem,
  type HeroCopy,
} from "@/src/features/oxelia51/content/defaults";
import { api } from "@/src/utils/api";

/**
 * Oxelia51 落地页 v2（2026-08-08 设计定稿）。
 * 结构仿 reasonix / CC Switch：Hero + 三步上手 + 特性 + 下载 + 社区 + FAQ + 页脚。
 * 主 CTA = 免费下载；登录/注册不再是前台；配色黑/白/心跳红。
 * 桌面应用/本地代理等已实现；未实现功能一律标注「即将推出」，不虚构。
 */
const GITHUB_URL = "https://github.com/XiaoleC05/Oxelia51";

// BASE_URL 必须含 /api/proxy 前缀（代理路由注册在 /api/proxy/<slug>/，见 registry.go）。
// 供应商 = LLM 平台；Agent = 用户使用的软件。展示示例命令 + 说明「换 slug 即换供应商」。
const LOCAL_PROXY_CMD = `export ANTHROPIC_BASE_URL="http://localhost:17800/api/proxy/anthropic"`;
const LOCAL_PROXY_CMD_OPENAI = `export OPENAI_BASE_URL="http://localhost:17800/api/proxy/deepseek"`;
const CLOUD_PROXY_CMD = `export ANTHROPIC_BASE_URL="https://oxelia51.com/api/proxy/anthropic"`;

export function LandingPage() {
  return (
    <>
      <Head>
        <title>Oxelia51 | 只需要改一行环境变量，所有 Token 消耗一目了然</title>
        <meta
          name="description"
          content="Oxelia51 是本地优先的个人 Token 记账本：数据存本地、按供应商与 Agent 统计。改一行环境变量，所有模型调用的 Token 消耗一目了然。"
        />
      </Head>
      <div className="ox-site-page flex min-h-screen flex-col">
        <SiteHeader />
        <main className="grow">
          <HeroSection />
          <HowItWorksSection />
          <FeaturesSection />
          <CommunityStrip />
          <FaqSection />
        </main>
        <SiteFooter />
        <BackToTop />
      </div>
    </>
  );
}

/* ---------------- Hero ---------------- */

function HeroSection() {
  const heroQ = api.siteContent.get.useQuery(
    { key: "landing_hero" },
    { staleTime: 60_000 },
  );
  const hero: HeroCopy = (heroQ.data as HeroCopy | null) ?? LANDING_HERO;
  // 下载量：服务端代理 GitHub Releases（缓存 1h）；失败为 null → 不渲染，不编造数字
  const statsQ = api.siteStats.downloadStats.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const stats = statsQ.data ?? null;
  return (
    <section className="relative overflow-hidden">
      {/* Hero 入场动效：每次进入页面都会播放（挂载触发，不依赖存储） */}
      <style>{`
        @keyframes ox-hero-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ox-hero-in {
          animation: ox-hero-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .ox-hero-in { animation: none; }
        }
      `}</style>
      {/* 背景辉光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--ox-accent) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-20">
        <div className="ox-hero-in" style={{ animationDelay: "0ms" }}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-(--ox-text-muted)"
            style={{ borderColor: "var(--ox-border)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-(--ox-accent)" />
            {hero.badge}
          </span>
        </div>

        <h1
          className="ox-hero-in mx-auto mt-6 max-w-3xl text-3xl leading-[1.3] font-bold tracking-tight text-(--ox-text-h) sm:text-5xl"
          style={{ animationDelay: "90ms" }}
        >
          {hero.title}
        </h1>
        <p
          className="ox-hero-in mx-auto mt-5 max-w-2xl text-base leading-7 text-(--ox-text-muted) sm:text-lg"
          style={{ animationDelay: "180ms" }}
        >
          {hero.subtitle}
        </p>

        <div
          className="ox-hero-in mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "270ms" }}
        >
          <Button asChild size="lg">
            <Link href="/download">
              {hero.ctaLabel}
              <Download className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs">
              <BookOpen className="mr-2 h-4 w-4" />
              查看文档
            </Link>
          </Button>
        </div>

        {/* 真实下载量（GitHub Releases）：仅服务端有数据时渲染 */}
        {stats && (
          <p
            className="ox-hero-in mt-3 text-xs text-(--ox-text-muted)"
            style={{ animationDelay: "300ms" }}
          >
            已被下载 {stats.totalDownloads.toLocaleString("zh-CN")} 次
          </p>
        )}

        {/* 平台徽章：可点击跳转到独立下载页对应平台 */}
        <div
          className="ox-hero-in mt-5 flex items-center justify-center gap-4 text-xs text-(--ox-text-muted)"
          style={{ animationDelay: "340ms" }}
        >
          <Link
            href="/download#windows"
            className="flex items-center gap-1 transition-colors hover:text-(--ox-accent)"
          >
            <Monitor className="h-3.5 w-3.5" /> Windows
          </Link>
          <Link
            href="/download#macos"
            className="flex items-center gap-1 transition-colors hover:text-(--ox-accent)"
          >
            <Apple className="h-3.5 w-3.5" /> macOS
          </Link>
          <Link
            href="/download#linux"
            className="flex items-center gap-1 transition-colors hover:text-(--ox-accent)"
          >
            <Terminal className="h-3.5 w-3.5" /> Linux
          </Link>
        </div>

        {/* 产品截图 mock */}
        <div
          className="ox-hero-in mx-auto mt-12 max-w-4xl"
          style={{ animationDelay: "420ms" }}
        >
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

/* ---------------- 三步上手 ---------------- */

function HowItWorksSection() {
  return (
    <section
      className="border-t py-16 sm:py-20"
      style={{ borderColor: "var(--ox-border)" }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="三步上手"
          title="从一行环境变量，到一目了然"
          desc="不装 SDK，不改代码，不碰 API Key。"
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Reveal delay={0}>
            <StepCard
              index={1}
              title="指向本地代理"
              desc="把模型工具的 Base URL 指向应用内置代理，一行环境变量即可。"
            >
              <CopyCodeBlock code={LOCAL_PROXY_CMD} />
              <p className="mt-2 text-xs text-(--ox-text-muted)">
                Claude Code / Anthropic SDK 用上面这条；OpenAI
                兼容工具（Cursor、CC Switch、Trae 等）用下面这条（换成你的供应商
                slug）：
              </p>
              <CopyCodeBlock code={LOCAL_PROXY_CMD_OPENAI} />
              <p className="mt-2 text-xs text-(--ox-text-muted)">
                内置 79
                条供应商路由（国内：DeepSeek、智谱、通义、Kimi、豆包、混元、星火、MiniMax、硅基流动…；国际：OpenAI、Gemini、Mistral、Grok、Groq…；聚合：OpenRouter、SiliconFlow…），slug
                即供应商。供应商 = 提供大模型的平台；Agent =
                你使用的软件，记录会自动按工具识别。云代理亦可用：
              </p>
              <CopyCodeBlock code={CLOUD_PROXY_CMD} />
            </StepCard>
          </Reveal>
          <Reveal delay={120}>
            <StepCard
              index={2}
              title="自动落账"
              desc="之后的每一次模型调用，Token 与成本自动记录，无需任何操作。"
            />
          </Reveal>
          <Reveal delay={240}>
            <StepCard
              index={3}
              title="打开仪表盘"
              desc="按时间、供应商、Agent 多维度查看，成本、异常一目了然。"
            />
          </Reveal>
        </div>

        {/* 数据流 */}
        <div
          className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-xl border px-5 py-4 text-sm"
          style={{
            borderColor: "var(--ox-border)",
            backgroundColor: "var(--ox-bg-alt)",
          }}
        >
          <span className="text-(--ox-text-h)">你的模型工具</span>
          <ArrowRight className="h-4 w-4 text-(--ox-accent)" />
          <span className="text-(--ox-text-h)">本地代理</span>
          <ArrowRight className="h-4 w-4 text-(--ox-accent)" />
          <span className="text-(--ox-text-h)">自动落账</span>
          <ArrowRight className="h-4 w-4 text-(--ox-accent)" />
          <span className="text-(--ox-text-h)">仪表盘</span>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  index,
  title,
  desc,
  children,
}: {
  index: number;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-xl border p-6"
      style={{
        borderColor: "var(--ox-border)",
        backgroundColor: "var(--ox-bg-alt)",
      }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: "var(--ox-accent)" }}
      >
        {index}
      </span>
      <h3 className="mt-4 text-base font-bold text-(--ox-text-h)">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-(--ox-text-muted)">{desc}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* ---------------- 特性 ---------------- */

const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <Code className="h-4 w-4" />,
    title: "零代码代理",
    desc: "不装 SDK、不改代码，改一行环境变量即接入；API Key 只转发不落库。",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "多维统计",
    desc: "按时间、供应商、Agent 拆解用量与成本，从多角度看清 Token 花在哪。",
  },
  {
    icon: <FolderKanban className="h-4 w-4" />,
    title: "供应商与 Agent",
    desc: "按 LLM 平台（供应商）与使用工具（Agent）双维度记录每笔调用。",
  },
  {
    icon: <BellRing className="h-4 w-4" />,
    title: "预算与告警",
    desc: "设定预算阈值，超限或异常消耗及时提醒，支持站内与邮件。",
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: "本地部署 · 数据本地",
    desc: "桌面应用数据全部存本地；自托管一条命令，数据不离开你的设备。",
  },
  {
    icon: <Terminal className="h-4 w-4" />,
    title: "国内模型适配",
    desc: "DeepSeek、Moonshot、智谱等开箱即用，内置 77 个模型参考价，支持美元/人民币切换。",
  },
];

function FeaturesSection() {
  return (
    <section
      className="border-t py-16 sm:py-20"
      style={{ borderColor: "var(--ox-border)" }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="特性" title="Token 记账本，本地优先" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div
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
                  {f.icon}
                </span>
                <h3 className="text-sm font-bold text-(--ox-text-h)">
                  {f.title}
                </h3>
                <p className="text-xs leading-5 text-(--ox-text-muted)">
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 社区（导流至 /community 独立页） ---------------- */

function CommunityStrip() {
  return (
    <section
      className="border-t py-12"
      style={{ borderColor: "var(--ox-border)" }}
    >
      <Reveal>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 text-center">
          <span className="text-(--ox-accent)">
            <SiGithub className="h-5 w-5" />
          </span>
          <p className="max-w-md text-sm leading-6 text-(--ox-text-muted)">
            Oxelia51 以 MIT 许可证开源。贡献代码、提需求、参与共建，都在社区。
          </p>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/community">进入社区</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const faqQ = api.siteContent.get.useQuery(
    { key: "landing_faq" },
    { staleTime: 60_000 },
  );
  const faq: FaqItem[] = (faqQ.data as FaqItem[] | null) ?? LANDING_FAQ;
  return (
    <section
      className="border-t py-16 sm:py-20"
      style={{ borderColor: "var(--ox-border)" }}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="常见问题" />
        <div className="mt-10 flex flex-col gap-2">
          {faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 40}>
                <div
                  className="ox-card-hover overflow-hidden rounded-xl border"
                  style={{
                    borderColor: "var(--ox-border)",
                    backgroundColor: "var(--ox-bg-alt)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-(--ox-text-h)"
                  >
                    {item.q}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-(--ox-text-muted) transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {/* 答案卡片：grid-rows 平滑展开/收起（替代瞬间硬切），内容延迟淡入 */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div
                      className={`min-h-0 overflow-hidden transition-opacity duration-300 ${
                        isOpen ? "opacity-100 delay-100" : "opacity-0"
                      }`}
                    >
                      <div
                        className="border-t px-5 py-4 text-sm leading-6 text-(--ox-text-muted)"
                        style={{ borderColor: "var(--ox-border)" }}
                      >
                        {item.a}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 通用 ---------------- */

function SectionHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <Reveal>
      <div className="text-center">
        <span className="text-xs font-bold tracking-widest text-(--ox-accent) uppercase">
          {eyebrow}
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-(--ox-text-h) sm:text-3xl">
          {title}
        </h2>
        {desc && (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-(--ox-text-muted)">
            {desc}
          </p>
        )}
      </div>
    </Reveal>
  );
}
