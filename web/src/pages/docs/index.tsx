import type { GetServerSideProps } from "next";

/**
 * 文档站首页：重定向到第一篇「快速开始」。
 */
export default function DocsIndex() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/docs/quickstart",
    permanent: false,
  },
});
