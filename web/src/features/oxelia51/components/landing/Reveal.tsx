"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/src/utils/tailwind";

/**
 * 滚动动画：元素进入视口时淡入上移，离开视口时淡出。
 * 双向触发——每次滚动经过元素都会播放动画，而非仅第一次。
 * 尊重 prefers-reduced-motion（直接显示）；首屏 Hero 不套用（Hero 有独立入场动效）。
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** 进入动画延迟（ms），用于卡片错峰 */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "min-w-0 transition-all duration-700 ease-out will-change-[opacity,transform]",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
