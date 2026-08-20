import Head from "next/head";
import { SiteHeader } from "@/src/features/oxelia51/components/site/SiteHeader";
import { SiteFooter } from "@/src/features/oxelia51/components/site/SiteFooter";
import { Reveal } from "@/src/features/oxelia51/components/landing/Reveal";
import {
  CHANGELOG_VERSIONS,
  type ChangelogVersion,
} from "@/src/features/oxelia51/content/defaults";
import { api } from "@/src/utils/api";

/**
 * Oxelia51 独立更新日志页（/changelog）：版本发布记录。
 * 数据优先读 oxelia51.site_content（管理台「内容编辑」可改，无需发版），
 * 未配置时回退默认值。skipAppLayout，全匿名可访问。
 */

function VersionCard({ v, index }: { v: ChangelogVersion; index: number }) {
  return (
    <Reveal delay={index * 80}>
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--ox-border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-(--ox-text-h)">
              {v.tag}
            </span>
            <span
              className={
                v.status === "planned"
                  ? "rounded-full bg-(--ox-accent)/10 px-2 py-0.5 text-xs font-bold text-(--ox-accent)"
                  : "rounded-full border px-2 py-0.5 text-xs text-(--ox-text-muted)"
              }
              style={
                v.status === "released"
                  ? { borderColor: "var(--ox-border)" }
                  : undefined
              }
            >
              {v.status === "planned" ? "规划中" : "已发布"}
            </span>
          </span>
          <span className="text-xs text-(--ox-text-muted)">{v.date}</span>
        </div>
        <p className="mt-3 text-sm font-bold text-(--ox-text-h)">{v.summary}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {v.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm leading-6 text-(--ox-text-muted)"
            >
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-(--ox-accent)" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export default function ChangelogPage() {
  const versionsQ = api.siteContent.get.useQuery(
    { key: "changelog_versions" },
    { staleTime: 60_000 },
  );
  const versions =
    (versionsQ.data as ChangelogVersion[] | null) ?? CHANGELOG_VERSIONS;
  return (
    <>
      <Head>
        <title>更新日志 · Oxelia51</title>
        <meta
          name="description"
          content="Oxelia51 更新日志：各版本发布记录与规划路线。"
        />
      </Head>
      <div className="ox-site-page flex min-h-screen flex-col">
        <SiteHeader />
        <main className="grow">
          <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <h1 className="text-3xl font-bold tracking-tight text-(--ox-text-h) sm:text-4xl">
                更新日志
              </h1>
            </Reveal>

            <div className="mt-12 flex flex-col gap-4">
              {versions.map((v, i) => (
                <VersionCard key={v.tag} v={v} index={i} />
              ))}
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

ChangelogPage.skipAppLayout = true;
