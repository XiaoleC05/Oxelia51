import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import { DocsLayout } from "@/src/features/oxelia51/components/docs/DocsLayout";
import { DocsMarkdown } from "@/src/features/oxelia51/components/docs/DocsMarkdown";
import { Reveal } from "@/src/features/oxelia51/components/landing/Reveal";
import type { Doc } from "@/src/features/oxelia51/components/docs/docs-shared";

/**
 * 文档站正文页（/docs/[...slug]）。
 * 构建期动态 import fs 加载器读取 src/content/docs/*.md，运行时无需 fs；
 * skipAppLayout 绕过应用外壳，文档站独立布局、全匿名可访问。
 */
export default function DocPage({
  doc,
  allDocs,
}: {
  doc: Doc;
  allDocs: Doc[];
}) {
  return (
    <>
      <Head>
        <title>{`${doc.title} · Oxelia51 文档`}</title>
        <meta name="description" content={`${doc.title} — Oxelia51 使用文档`} />
      </Head>
      <DocsLayout allDocs={allDocs} activeSlug={doc.slug[0]}>
        {/* key 强制文章切换时重挂载，让入场动画每次切换都播放 */}
        <Reveal key={doc.slug[0]}>
          <DocsMarkdown content={doc.content} />
        </Reveal>
      </DocsLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { getAllDocs } =
    await import("@/src/features/oxelia51/components/docs/docs-content");
  const allDocs = getAllDocs();
  return {
    paths: allDocs.map((d) => ({ params: { slug: d.slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<{
  doc: Doc;
  allDocs: Doc[];
}> = async ({ params }) => {
  const { getDoc, getAllDocs } =
    await import("@/src/features/oxelia51/components/docs/docs-content");
  const slug = (params?.slug as string[] | undefined) ?? [];
  const doc = getDoc(slug);
  const allDocs = getAllDocs();
  if (!doc) {
    return { notFound: true };
  }
  return { props: { doc, allDocs } };
};

DocPage.skipAppLayout = true;
