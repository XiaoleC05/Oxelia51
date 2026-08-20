import type { GetServerSideProps } from "next";

/** 个人工作台首页：重定向到总览。 */
export default function AppIndex() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/app/overview", permanent: false },
});
