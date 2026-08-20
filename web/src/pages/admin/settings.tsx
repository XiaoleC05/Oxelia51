import { type GetServerSideProps } from "next";

/**
 * 旧独立设置页已并入管理台「设置」Tab（/admin?tab=settings）。
 * 保留本路由仅为兼容旧书签 / 外链：服务端 302 重定向，避免 404。
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/admin?tab=settings",
    permanent: false,
  },
});

export default function AdminSettingsRedirect() {
  return null;
}
