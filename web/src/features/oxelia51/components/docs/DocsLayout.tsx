import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "@/src/features/oxelia51/components/site/SiteHeader";
import { SiteFooter } from "@/src/features/oxelia51/components/site/SiteFooter";
import { groupDocsBySection, type Doc } from "./docs-shared";

/**
 * 文档站布局：顶栏 + 左侧章节目录 + 正文 + 页脚。
 * 服务端组件（activeSlug 由页面传入），不引入 node 依赖。
 */
export function DocsLayout({
  allDocs,
  activeSlug,
  children,
}: {
  allDocs: Doc[];
  activeSlug: string;
  children: ReactNode;
}) {
  const groups = groupDocsBySection(allDocs);

  return (
    <div className="ox-site-page flex min-h-screen flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl grow px-4 sm:px-6">
        <div className="flex gap-10 py-10">
          {/* 左侧目录 */}
          <aside className="hidden w-52 shrink-0 md:block">
            <nav className="sticky top-20 flex flex-col gap-6">
              {groups.map((group) => (
                <div key={group.section}>
                  <h4 className="mb-2 px-1 text-xs font-bold tracking-widest text-(--ox-text-muted) uppercase">
                    {group.section}
                  </h4>
                  <ul className="flex flex-col gap-0.5">
                    {group.docs.map((doc) => {
                      const active = doc.slug[0] === activeSlug;
                      return (
                        <li key={doc.slug[0]}>
                          <Link
                            href={`/docs/${doc.slug[0]}`}
                            className={
                              active
                                ? "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-bold text-(--ox-accent)"
                                : "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-(--ox-text-muted) transition-colors hover:text-(--ox-text-h)"
                            }
                            style={
                              active
                                ? {
                                    backgroundColor:
                                      "color-mix(in srgb, var(--ox-accent) 10%, transparent)",
                                  }
                                : undefined
                            }
                          >
                            {active && (
                              <ChevronRight className="h-3 w-3 shrink-0" />
                            )}
                            {doc.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* 正文 */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
