"use client";

import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/src/utils/tailwind";

/**
 * 文档站 markdown 渲染：react-markdown + GFM，统一黑白红配色。
 * 代码块使用等宽字体 + 主题边框；链接内部用 next/link，外部新开标签。
 */
export function DocsMarkdown({ content }: { content: string }) {
  return (
    <div className="max-w-2xl min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 text-2xl font-bold tracking-tight text-(--ox-text-h)">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="mt-9 mb-3 border-b pb-2 text-lg font-bold text-(--ox-text-h)"
      style={{ borderColor: "var(--ox-border)" }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-base font-bold text-(--ox-text-h)">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-sm leading-6 text-(--ox-text-muted)">{children}</p>
  ),
  a: ({ href, children }) => {
    const isExternal = href?.startsWith("http");
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-(--ox-accent) underline underline-offset-2"
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href ?? "#"}
        className="text-(--ox-accent) underline underline-offset-2"
      >
        {children}
      </Link>
    );
  },
  ul: ({ children }) => (
    <ul className="my-3 list-disc pl-5 text-sm text-(--ox-text-muted)">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal pl-5 text-sm text-(--ox-text-muted)">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="mt-1 leading-6">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-(--ox-text-h)">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-6" style={{ borderColor: "var(--ox-border)" }} />,
  blockquote: ({ children }) => (
    <blockquote
      className="my-4 border-l-2 pl-4 text-sm text-(--ox-text-muted) italic"
      style={{ borderColor: "var(--ox-accent)" }}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code
          className={cn(
            "block overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-5",
            className,
          )}
          style={{
            borderColor: "var(--ox-border)",
            backgroundColor: "var(--ox-bg-alt)",
            color: "var(--ox-text-h)",
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded border px-1.5 py-0.5 font-mono text-xs"
        style={{
          borderColor: "var(--ox-border)",
          backgroundColor: "var(--ox-bg-alt)",
          color: "var(--ox-accent)",
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-3">{children}</pre>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        style={{ borderColor: "var(--ox-border)" }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className="border px-3 py-2 text-left font-bold text-(--ox-text-h)"
      style={{
        borderColor: "var(--ox-border)",
        backgroundColor: "var(--ox-bg-alt)",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      className="border px-3 py-2 text-(--ox-text-muted)"
      style={{ borderColor: "var(--ox-border)" }}
    >
      {children}
    </td>
  ),
};
