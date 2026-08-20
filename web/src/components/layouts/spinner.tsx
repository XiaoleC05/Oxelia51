/**
 * Oxelia51 品牌加载动画「伴星」：心跳星点绕月环旋转，永不闭合距离。
 * 内联 SVG（CSS 动画，合成器线程执行，无 SMIL 首帧启动卡顿），零网络请求，加载界面永不缺失。
 * 月环颜色继承 text-primary，双主题自适应；星点固定品牌红 #E5484D。
 */
function OrbitLoader({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-70 -70 596 596"
      fill="none"
      aria-hidden="true"
    >
      <style>
        {
          "@keyframes ox-orbit { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .ox-orbit { animation: none !important; } }"
        }
      </style>
      <circle
        cx="228"
        cy="228"
        r="140"
        stroke="currentColor"
        strokeWidth="52"
      />
      {/* transformBox: view-box 让 transform-origin 以 SVG viewBox 坐标（月环圆心 228,228）为参照 */}
      <g
        className="ox-orbit"
        style={{
          transformOrigin: "228px 228px",
          transformBox: "view-box",
          animation: "ox-orbit 2.6s linear infinite",
        }}
      >
        <circle cx="488" cy="228" r="34" fill="#E5484D" />
      </g>
    </svg>
  );
}

export function Spinner(props: { message: string }) {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-primary mx-auto w-fit">
          <OrbitLoader size={42} />
        </div>
        <h2 className="text-primary mt-5 text-center text-2xl leading-9 font-bold tracking-tight">
          {props.message}
          <span className="animate-pulse">…</span>
        </h2>
      </div>
    </div>
  );
}
