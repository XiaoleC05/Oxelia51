"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 社区贡献者「双轨对向滚动」头像墙（P2 收尾）。
 * 贡献者较多时启用：上半行向左滚动、下半行向右滚动，两端边缘渐隐；
 * 悬停时滚动逐渐减速并最终静止（便于查看），点击头像跳转对应 GitHub 主页。
 * 贡献者较少时退回静态头像堆叠，避免空旷；尊重 prefers-reduced-motion。
 */

type Contributor = { login: string; avatar_url: string };

const THRESHOLD = 8; // 达到该数量才启用双轨滚动
const PX_PER_SEC = 40; // 基础滚动速度 px/s
const EASE_STOP = 0.1; // 悬停减速系数（约 0.5s 内停下）
const EASE_RUN = 0.04; // 恢复滚动时的加速系数

function Row({
  contributors,
  dir,
  paused,
}: {
  contributors: Contributor[];
  dir: 1 | -1;
  paused: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const vel = useRef(PX_PER_SEC); // 速度恒正：方向由下方 x 公式决定，pos 始终向前累计
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // 逐帧驱动滚动：悬停时速度指数减速到 0，离开后重新加速（无缝循环，内容复制两份）
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // 系统偏好减少动态：静态展示
    }
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (last == null) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const half = el.scrollWidth / 2; // 一份内容的宽度（内容复制了两份）
      if (half <= 0) return;
      const target = pausedRef.current ? 0 : PX_PER_SEC;
      const k = Math.min(
        (pausedRef.current ? EASE_STOP : EASE_RUN) * dt * 60,
        1,
      );
      vel.current += (target - vel.current) * k;
      if (pausedRef.current && Math.abs(vel.current) < 0.5) vel.current = 0;
      pos.current += vel.current * dt;
      pos.current = ((pos.current % half) + half) % half;
      // dir=1 向左：x=-pos；dir=-1 向右：x=pos-half（pos 递增 → x 递增 → 右移）
      const x = dir === 1 ? -pos.current : pos.current - half;
      el.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dir]);

  const doubled = [...contributors, ...contributors];

  return (
    <div ref={trackRef} className="flex w-max items-center gap-3 py-1">
      {doubled.map((c, i) => (
        <a
          key={`${c.login}-${i}`}
          href={`https://github.com/${c.login}`}
          target="_blank"
          rel="noreferrer"
          title={c.login}
          className="shrink-0 transition-transform duration-200 hover:z-10 hover:scale-110"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.avatar_url}
            alt={c.login}
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 rounded-full border-2"
            style={{
              borderColor: "var(--ox-bg)",
              backgroundColor: "var(--ox-border-light)",
            }}
          />
        </a>
      ))}
    </div>
  );
}

/** 贡献者较少时的静态头像堆叠（原行为，避免空旷）。 */
function StaticStack({ contributors }: { contributors: Contributor[] }) {
  return (
    <div className="flex items-center justify-center">
      <div className="flex -space-x-2">
        {contributors.map((c) => (
          <a
            key={c.login}
            href={`https://github.com/${c.login}`}
            target="_blank"
            rel="noreferrer"
            title={c.login}
            className="transition-transform duration-200 hover:z-10 hover:scale-110"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.avatar_url}
              alt={c.login}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border-2"
              style={{
                borderColor: "var(--ox-bg)",
                backgroundColor: "var(--ox-border-light)",
              }}
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export function ContributorMarquee({
  contributors,
}: {
  contributors: Contributor[];
}) {
  const [paused, setPaused] = useState(false);

  if (contributors.length < THRESHOLD) {
    return <StaticStack contributors={contributors} />;
  }

  const half = Math.ceil(contributors.length / 2);
  const top = contributors.slice(0, half);
  const bottom = contributors.slice(half);

  return (
    <div
      className="ox-contributor-marquee w-full max-w-3xl overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <div className="flex flex-col">
        <Row contributors={top} dir={1} paused={paused} />
        <Row contributors={bottom} dir={-1} paused={paused} />
      </div>
    </div>
  );
}
