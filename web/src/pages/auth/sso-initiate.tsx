import { signIn } from "next-auth/react";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ErrorPageWithSentry } from "@/src/components/error-page";
import { Spinner } from "@/src/components/layouts/spinner";

export default function SSOInitiate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for router to be ready
    if (!router.isReady) {
      return;
    }

    const provider = router.query.provider as string | undefined;

    // If provider is missing or empty, show error
    if (!provider || provider === "") {
      setError("未指定单点登录提供商，请联系您的管理员。");
      return;
    }

    // Automatically trigger sign-in with the provider
    signIn(provider)
      .then(() => {
        // signIn will redirect automatically on success
        // No need to do anything here
      })
      .catch((error) => {
        console.error("SSO initiation error:", error);
        setError(
          error instanceof Error
            ? error.message
            : "启动单点登录失败，请重试或联系支持。",
        );
      });
  }, [router.isReady, router.query.provider]);

  // Show error page if sign-in failed
  if (error) {
    return (
      <>
        <Head>
          <title>登录错误 | Oxelia51</title>
        </Head>
        <ErrorPageWithSentry title="单点登录失败" message={error} />
      </>
    );
  }

  // Show loading spinner while processing
  return (
    <>
      <Head>
        <title>正在登录 | Oxelia51</title>
      </Head>
      <Spinner message="正在跳转至您的身份提供商..." />
    </>
  );
}
