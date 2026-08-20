"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { type ReactNode } from "react";
import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";

/**
 * 管理台三态门控：加载中 → 需要登录 / 校验失败 / 无权限 → 管理台内容。
 * 由 /admin 页面统一包裹（设置等子功能均为其 Tab）；数据 procedure 服务端另有 adminProcedure 拦截，双保险。
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && Boolean(session?.user);

  // staleTime: 0 —— 每次进入都实时校验身份，避免同 SPA 会话内换账号后
  // 命中旧缓存把非管理员渲染成管理员（服务端仍有 adminProcedure 兜底，不泄露数据）。
  const whoami = api.oxelia51Admin.whoami.useQuery(undefined, {
    enabled: authed,
    staleTime: 0,
  });

  if (status === "loading" || (authed && whoami.isLoading)) {
    return <p className="text-muted-foreground text-sm">加载中…</p>;
  }

  if (!authed) {
    // 防御性兜底：布局层 useAuthGuard 已把未登录访问重定向到 /auth/sign-in，
    // 正常情况下本分支不会渲染。
    return (
      <Card className="flex max-w-lg flex-col gap-3 p-6">
        <h2 className="font-heading text-lg font-bold">需要登录</h2>
        <p className="text-muted-foreground text-sm">
          管理台与平台账户统一认证，请先登录您的 Oxelia51 账户。
        </p>
        <Button asChild className="self-start">
          <Link href="/auth/sign-in">前往登录</Link>
        </Button>
      </Card>
    );
  }

  if (whoami.isError) {
    return (
      <Card className="flex max-w-lg flex-col gap-3 p-6">
        <h2 className="font-heading text-lg font-bold">身份校验失败</h2>
        <p className="text-muted-foreground text-sm">
          无法确认您的管理员身份，请检查网络后重试。
        </p>
        <div className="flex gap-2">
          <Button
            className="self-start"
            onClick={() => {
              void whoami.refetch();
            }}
            loading={whoami.isFetching}
          >
            重试
          </Button>
          <Button asChild variant="ghost" className="self-start">
            <Link href="/">返回首页</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (!whoami.data?.isAdmin) {
    return (
      <Card className="flex max-w-lg flex-col gap-3 p-6">
        <h2 className="font-heading text-lg font-bold">无访问权限</h2>
        <p className="text-muted-foreground text-sm">
          管理台仅对管理员开放。当前账户（{session?.user?.email}
          ）没有管理权限，如需开通请联系平台管理员。
        </p>
        <Button asChild variant="ghost" className="self-start">
          <Link href="/">返回首页</Link>
        </Button>
      </Card>
    );
  }

  return <>{children}</>;
}
