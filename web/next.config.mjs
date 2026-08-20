/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.mjs");
import { withSentryConfig } from "@sentry/nextjs";
import { env } from "./src/env.mjs";

/**
 * CSP headers
 * img-src https to allow loading images from SSO providers
 */
const cspHeader = `
  default-src 'self' https://*.posthog.com https://*.sentry.io;
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://*.sentry.io  https://static.cloudflareinsights.com https://login.microsoftonline.com https://login.microsoft.com https://*.microsoftonline.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://login.microsoftonline.com https://login.microsoft.com https://*.microsoftonline.com;
  img-src 'self' https: blob: data: http://localhost:*;
  font-src 'self';
  frame-src 'self' https://challenges.cloudflare.com https://login.microsoftonline.com https://login.microsoft.com https://*.microsoftonline.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self' https://login.microsoftonline.com https://login.microsoft.com https://*.microsoftonline.com;
  frame-ancestors 'none';
  connect-src 'self' https://api.github.com https://*.ingest.us.sentry.io https://*.sentry.io https://login.microsoftonline.com https://login.microsoft.com https://*.microsoftonline.com https://graph.microsoft.com;
  media-src 'self' https: http://localhost:*;
  ${env.LANGFUSE_CSP_ENFORCE_HTTPS === "true" ? "upgrade-insecure-requests; block-all-mixed-content;" : ""}
  ${env.SENTRY_CSP_REPORT_URI ? `report-uri ${env.SENTRY_CSP_REPORT_URI}; report-to csp-endpoint;` : ""}
`;

const reportToHeader = {
  key: "Report-To",
  value: JSON.stringify({
    group: "csp-endpoint",
    max_age: 10886400,
    endpoints: [
      {
        url: env.SENTRY_CSP_REPORT_URI,
      },
    ],
    include_subdomains: true,
  }),
};

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Emit and serve browser source maps in production so browser devtools
  // de-minify client stacks automatically. NOTE: this alone does NOT make Sentry
  // legible — the Sentry SDK rewrites frames to the `app:///` scheme, which is
  // not a fetchable URL, so Sentry cannot pull these public maps. Sentry
  // symbolication is handled separately by uploading maps with debug IDs (see
  // `sourcemaps` in withSentryConfig below).
  productionBrowserSourceMaps: true,
  // Allow building to alternate directory for parallel build checks while dev server runs
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    // CI test jobs run `pnpm run typecheck` separately and skip duplicate
    // Next.js type checks to keep test builds fast. Production/Docker builds
    // do not set this flag and still fail on TypeScript errors.
    ignoreBuildErrors: process.env.NEXT_IGNORE_BUILD_ERRORS === "true",
  },
  // Agent/browser tooling often targets 127.0.0.1 instead of localhost in dev.
  allowedDevOrigins: ["127.0.0.1"],
  staticPageGenerationTimeout: 500, // default is 60. Required for build process for amd
  transpilePackages: ["@oxelia51/shared"],
  reactStrictMode: true,
  serverExternalPackages: [
    "dd-trace",
    "@opentelemetry/api",
    "@appsignal/opentelemetry-instrumentation-bullmq",
    "bullmq",
    "@opentelemetry/sdk-node",
    "@opentelemetry/instrumentation-winston",
  ],
  poweredByHeader: false,
  basePath: env.NEXT_PUBLIC_BASE_PATH,
  compiler: {
    define: {
      "import.meta.vitest": "undefined",
    },
  },
  turbopack: {
    rules: {
      "*.md": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  logging: {
    browserToTerminal: true,
  },
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },

  /**
   * Oxelia51：站点已全面中文化（HTML lang=zh-CN），删除 i18n 配置——
   * 消除 /en 等 locale 路由与浏览器语言自动重定向导致的「路由混乱」。
   * 注意：删除后 /en 将返回 404，所有页面走无前缀路径。
   */
  output: "standalone",

  async headers() {
    return [
      {
        // Add noindex for all pages except root and /auth*
        source: "/:path((?!auth|^$).*)*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Document-Policy",
            value: "js-profiling",
          },
          {
            key: "Permissions-Policy",
            value: "autoplay=*, fullscreen=*, microphone=*",
          },
          ...(env.SENTRY_CSP_REPORT_URI ? [reportToHeader] : []),
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "x-frame-options",
            value: "SAMEORIGIN",
          },
        ],
      },
      // CSP header
      {
        source: "/:path((?!api).*)*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\n/g, ""),
          },
        ],
      },
    ];
  },

  webpack(config, { isServer, webpack }) {
    // Exclude Datadog packages from webpack bundling to avoid issues
    // see: https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/dd_libraries/nodejs/#bundling-with-nextjs
    config.externals.push("@datadog/pprof", "dd-trace");

    config.module.rules.push({
      test: /\.md$/i,
      type: "asset/source",
    });

    // Setup in-source testing: https://vitest.dev/guide/in-source.html#other-bundlers
    config.plugins.push(
      new webpack.DefinePlugin({
        "import.meta.vitest": "undefined",
      }),
    );

    return config;
  },
};

const sentryConfig = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  authToken: env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/api/monitoring-tunnel",

  // Upload source maps to Sentry with debug IDs so Sentry can symbolicate
  // minified production stack traces. This restores upload that regressed in the
  // Sentry v8->v10 upgrade (#8934): it mistranslated the old `hideSourceMaps:
  // true` (upload, then hide from the public bundle) into `sourcemaps.disable`
  // (do not upload at all) — the correct v10 equivalent was
  // `deleteSourcemapsAfterUpload: true` — so Sentry stacks have been minified
  // since. Upload worked across all regions/orgs/projects under v8 via the same
  // per-region SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN this reads. Debug IDs
  // match a map to an event by an embedded id, independent of URLs and the
  // `app:///` frame rewrite — which is why serving maps at a public
  // sourceMappingURL (#15277) can't symbolicate Sentry. Upload runs only when
  // SENTRY_AUTH_TOKEN is present (prod builds) and targets the per-region
  // org/project/release baked into each region's build. We also keep serving the
  // maps publicly (`productionBrowserSourceMaps` above, for devtools), so unlike
  // the old `hideSourceMaps` we do NOT delete them after upload.
  sourcemaps: {
    deleteSourcemapsAfterUpload: false,
  },

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: false,

  webpack: {
    // Automatically annotate React components to show their full name in breadcrumbs and session replay.
    reactComponentAnnotation: {
      enabled: true,
    },

    // Automatically tree-shake Sentry logger statements to reduce bundle size.
    treeshake: {
      removeDebugLogging: true,
    },
  },
  });

export default sentryConfig;
