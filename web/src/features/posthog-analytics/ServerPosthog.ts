import { env } from "@/src/env.mjs";
import { PostHog } from "posthog-node";

// oxelia51 fork: the upstream fallback to Langfuse's own PostHog project
// (hardcoded key + eu.posthog.com host) was removed. Server-side
// analytics/telemetry is only active when the operator configures their own
// NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST; otherwise this client
// stays disabled (null) and no data leaves the deployment.
export class ServerPosthog {
  private posthog: PostHog | null;

  constructor() {
    const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY ?? null;
    const host = env.NEXT_PUBLIC_POSTHOG_HOST ?? null;

    if (apiKey && host) {
      this.posthog = new PostHog(apiKey, { host });
      if (process.env.NODE_ENV === "development") this.posthog.debug();
    } else {
      this.posthog = null;
    }
  }

  capture(...args: Parameters<PostHog["capture"]>) {
    this.posthog?.capture(...args);
  }

  async shutdown() {
    await this.posthog?.shutdown();
  }

  async flush() {
    await this.posthog?.flush();
  }
}
