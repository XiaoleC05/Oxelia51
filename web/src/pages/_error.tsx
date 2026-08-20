import {
  captureUnderscoreErrorException,
  isEnabled as isSentryEnabled,
} from "@sentry/nextjs";
import Head from "next/head";
import NextErrorComponent, { type ErrorProps } from "next/error";
import type { NextPageContext } from "next";
import { CrashModal } from "@/src/components/CrashModal/CrashModal";

type LangfuseErrorPageProps = ErrorProps & {
  sentryEventId?: string;
  showReturnHome: boolean;
};

const statusTitles: Record<number, string> = {
  400: "请求错误",
  404: "无法找到该页面",
  405: "不允许的请求方法",
  500: "服务器内部错误",
};

const ErrorPage = ({
  hostname,
  sentryEventId,
  showReturnHome,
  statusCode,
  title,
}: LangfuseErrorPageProps) => {
  const resolvedTitle =
    title ??
    (statusCode ? statusTitles[statusCode] : undefined) ??
    "发生了未知错误";

  const description = statusCode
    ? `${resolvedTitle}。`
    : `应用错误：客户端发生异常${
        hostname ? `，加载 ${hostname} 时` : ""
      }（详见浏览器控制台）。`;

  const documentTitle = statusCode
    ? `${statusCode}: ${resolvedTitle}`
    : "应用错误：客户端发生异常";

  return (
    <>
      <Head>
        <title>{documentTitle}</title>
      </Head>
      <div className="min-h-screen-with-banner bg-background text-foreground flex items-center justify-center px-6 py-10">
        <CrashModal
          description={description}
          sentryEventId={sentryEventId}
          showReturnHome={showReturnHome}
          statusCode={statusCode}
        />
      </div>
    </>
  );
};

ErrorPage.skipAppLayout = true;

ErrorPage.getInitialProps = async (
  context: NextPageContext,
): Promise<LangfuseErrorPageProps> => {
  const errorInitialProps = await NextErrorComponent.getInitialProps(context);
  const sentryEventId = isSentryEnabled()
    ? await captureUnderscoreErrorException(context)
    : undefined;
  const pathname = context.asPath?.split(/[?#]/)[0];

  return {
    ...errorInitialProps,
    sentryEventId,
    showReturnHome: pathname !== "/",
  };
};

export default ErrorPage;
