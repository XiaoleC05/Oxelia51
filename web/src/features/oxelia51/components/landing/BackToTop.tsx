"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * 回到顶部按钮：滚动超过一屏后浮现，点击平滑回到页首。
 */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      aria-label="回到顶部"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        })
      }
      className="fixed right-5 bottom-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-all hover:-translate-y-0.5"
      style={{
        borderColor: "var(--ox-border)",
        backgroundColor: "var(--ox-bg)",
        color: "var(--ox-text-h)",
      }}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
