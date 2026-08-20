import { Html, Head, Main, NextScript } from "next/document";

import { LAYER_ORDER } from "@/src/components/ui/layer";

// Umami 自托管统计（stats.oxelia51.com，部署见 Oxelia51/deploy/umami/）。
// 两个 env 齐备才注入脚本；未配置则不加载任何统计代码。
// NEXT_PUBLIC_* 为构建期内联变量，在 _document（服务端）直接读 process.env 即可。
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;

// The app renders inside #__next (<Main />), which is isolated into its own
// stacking context (globals.css). The overlay layer containers are declared
// here as <body> siblings AFTER #__next, so they paint above the whole app by
// DOM order — no z-index needed. They are static HTML (present at SSR), ordered
// by LAYER_ORDER (later = on top); <Layer> (components/ui/layer.tsx) finds its
// container and portals into it. Styling lives in globals.css.
export default function Document() {
  return (
    // lang is set explicitly (not left to the i18n config, which is being
    // phased out in App Router) so screen readers always get the document
    // language — WCAG 2.1 SC 3.1.1.
    // next-themes mutates class/style on <html> before hydration; suppress the
    // expected mismatch one level deep (React 19 logs it and can re-render).
    <Html lang="zh-CN" suppressHydrationWarning>
      <Head>
        {/* 全局 favicon（AuthenticatedLayout 只覆盖登录后页面，auth 页在此兜底） */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="256x256" href="/icon256.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Oxelia51 双主题防闪烁：首帧渲染前从 localStorage 恢复 data-theme，
            与 theming/oxelia51-theme.ts 的存储键保持一致。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("oxelia51-theme")==="cosmos"?"cosmos":"cozy"}catch(e){document.documentElement.dataset.theme="cozy"}`,
          }}
        />
        {/* 浏览器兼容提示（Tailwind CSS v4 要求 Chrome/Edge 111+）：
            老版百度浏览器 / 兼容模式的 Chromium 不支持 @layer / color-mix() / CSS 嵌套，
            Tailwind v4 生成的样式全部失效，页面表现为"格式错乱、样式丢失"。
            此脚本用纯 JS + 内联样式注入横幅（目标浏览器渲染不了 Tailwind 类，
            甚至 React 都可能无法运行），明确告知用户升级浏览器或切「极速模式」。
            带 ✕ 关闭按钮；关闭后记入 localStorage，同浏览器不再重复弹出。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(typeof CSS==="undefined"||!CSS.supports||!CSS.supports("color-mix(in srgb, red 50%, blue)")){if(localStorage.getItem("oxelia51-browser-banner-dismissed")==="1")return;var show=function(){var b=document.body;if(!b)return;var x=document.createElement("div");x.style.cssText="position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#fef3c7;color:#78350f;font-size:13px;line-height:1.5;padding:8px 36px 8px 16px;text-align:center;border-bottom:1px solid #f59e0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif";x.textContent="您的浏览器版本过旧，Oxelia51 网站可能无法正常显示。请使用 Chrome / Edge 111 以上版本，或将浏览器切换到「极速模式」后刷新重试。";var btn=document.createElement("button");btn.type="button";btn.setAttribute("aria-label","关闭提示");btn.innerHTML="&#x2715;";btn.style.cssText="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;color:#b45309;font-size:14px;line-height:1;padding:4px";btn.onclick=function(){try{localStorage.setItem("oxelia51-browser-banner-dismissed","1")}catch(e){};if(x.parentNode)x.parentNode.removeChild(x)};x.appendChild(btn);b.insertBefore(x,b.firstChild)};if(document.body)show();else document.addEventListener("DOMContentLoaded",show)}}catch(e){}})();`,
          }}
        />
        {/* Umami 统计脚本：async+defer 不阻塞渲染；仅 env 齐备时注入 */}
        {UMAMI_WEBSITE_ID && UMAMI_SRC ? (
          <script
            async
            defer
            src={UMAMI_SRC}
            data-website-id={UMAMI_WEBSITE_ID}
          />
        ) : null}
      </Head>
      <body>
        <Main />
        <div data-overlay-root>
          {LAYER_ORDER.map((name) => (
            <div key={name} data-layer={name} />
          ))}
        </div>
        <NextScript />
      </body>
    </Html>
  );
}
