import fs from "node:fs";
import path from "node:path";
import type { Doc, DocMeta } from "./docs-shared";

/**
 * 文档站内容加载器（服务端专用）。
 * 读取 `web/src/content/docs/*.md`，解析 frontmatter（title/section/order）。
 * 仅用于 getStaticProps/getStaticPaths（构建期），且应在函数内动态 import，
 * 避免 `node:fs` 进入客户端 bundle。运行时无需 fs。
 */

const DOCS_DIR = path.join(process.cwd(), "src/content/docs");

function parseFrontmatter(raw: string): { meta: DocMeta; body: string } {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`文档缺少 frontmatter：\n${raw.slice(0, 80)}`);
  }
  const metaBlock = match[1];
  const body = match[2];
  const meta: Partial<DocMeta> = {};
  for (const line of metaBlock.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "title") meta.title = value;
    else if (key === "section") meta.section = value;
    else if (key === "order") meta.order = Number.parseInt(value, 10) || 0;
  }
  if (!meta.title || !meta.section) {
    throw new Error(
      `文档 frontmatter 缺少 title/section：\n${raw.slice(0, 80)}`,
    );
  }
  return { meta: meta as DocMeta, body };
}

export function getAllDocs(): Doc[] {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(DOCS_DIR, file), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      return { ...meta, slug: [file.replace(/\.md$/, "")], content: body };
    })
    .sort((a, b) => a.order - b.order);
}

export function getDoc(slug: string[] | undefined): Doc | null {
  if (!slug || slug.length === 0) return null;
  const key = slug.join("/");
  return getAllDocs().find((d) => d.slug.join("/") === key) ?? null;
}
