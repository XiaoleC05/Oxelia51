"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** 落地页命令行代码块：等宽展示 + 一键复制。 */
export function CopyCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-(--ox-border) bg-(--ox-bg-alt) px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-(--ox-text)">
        {code}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "已复制" : "复制"}
        title={copied ? "已复制" : "复制"}
        className="shrink-0 text-(--ox-text-muted) transition-colors hover:text-(--ox-text-h)"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
