import { type GetServerSideProps } from "next";

/**
 * Oxelia51：原生首页仪表盘（无数据）已随 langfuse tracing 功能一并删除。
 * 项目首页固定改道到 Token 用量仪表盘。
 */
export default function ProjectIndexRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const projectId = ctx.params?.projectId;
  if (typeof projectId !== "string" || projectId.length === 0) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return {
    redirect: {
      destination: `/project/${projectId}/dashboard/tokens`,
      permanent: false,
    },
  };
};
