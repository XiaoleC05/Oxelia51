/**
 * 文档站纯类型与工具（无 node 依赖，可安全用于客户端组件）。
 * 服务端 fs 读取见 docs-content.ts。
 */

export type DocMeta = {
  title: string;
  section: string;
  order: number;
};

export type Doc = DocMeta & {
  /** 路由 slug（不含扩展名），如 ["quickstart"] */
  slug: string[];
  /** 正文 markdown（已去除 frontmatter） */
  content: string;
};

/** 按 section 分组，保持 order 顺序 */
export function groupDocsBySection(
  docs: Doc[],
): { section: string; docs: Doc[] }[] {
  const order: string[] = [];
  const map = new Map<string, Doc[]>();
  for (const doc of docs) {
    if (!map.has(doc.section)) {
      map.set(doc.section, []);
      order.push(doc.section);
    }
    map.get(doc.section)!.push(doc);
  }
  return order.map((section) => ({ section, docs: map.get(section)! }));
}
