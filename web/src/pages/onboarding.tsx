// This page is part of the cloud signup flow and can also be opened directly for local testing.

import Head from "next/head";
import { OnboardingSurvey } from "@/src/features/onboarding/components/OnboardingSurvey";

export default function OnboardingPage() {
  return (
    <>
      <Head>
        <title>新手引导 | Oxelia51</title>
        <meta
          name="description"
          content="开始使用 Oxelia51 — 了解您的 AI Token 消耗情况"
        />
      </Head>
      <OnboardingSurvey />
    </>
  );
}
