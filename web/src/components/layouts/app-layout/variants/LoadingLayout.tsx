/**
 * Loading layout variant
 * Shown during session loading and authentication redirects
 */

import { Spinner } from "@/src/components/layouts/spinner";

type LoadingLayoutProps = {
  message?: string;
};

export function LoadingLayout({ message = "加载中" }: LoadingLayoutProps) {
  return <Spinner message={message} />;
}
