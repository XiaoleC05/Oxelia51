"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { env } from "@/src/env.mjs";
import { Button } from "@/src/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { signOutCleanly } from "@/src/features/auth/lib/signOut";

/**
 * Oxelia51 独立管理台外壳：顶部条（品牌 + 返回网站 + 账户菜单）+ 内容区。
 * /admin 走 MinimalLayout（无业务侧边栏），与平台普通业务分离。
 * 用户菜单复用侧栏 NavUser 的 DropdownMenu/Avatar 原语与菜单项
 * （账户设置 / 退出登录），触发器改为顶栏紧凑形态。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/85 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            {/* 品牌 glyph：随主题切换深浅版（h-7 sm:h-8，与工作台顶栏同规格） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="h-7 w-7 sm:h-8 sm:w-8 dark:hidden"
              src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-glyph-64.png`}
              alt="Oxelia51"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hidden h-7 w-7 sm:h-8 sm:w-8 dark:block"
              src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-glyph-64-dark.png`}
              alt="Oxelia51"
            />
            <span className="font-heading text-base font-bold">
              Oxelia51 管理台
            </span>
          </Link>
          {/* 右侧操作区：工作台 + 返回网站 + 账户菜单，统一间距 */}
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app">
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                工作台
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                返回网站
              </Link>
            </Button>
            {user && <AdminUserMenu />}
          </div>
        </div>
      </header>
      {/* pb-16：为 MinimalLayout 吸底页脚留出空间；key=pathname 重放进入动画 */}
      <div
        key={router.pathname}
        className="ox-page-in mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16"
      >
        {children}
      </div>
    </div>
  );
}

function AdminUserMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const name = user.name ?? "";
  const email = user.email ?? "";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
          aria-label="账户菜单"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.image ?? ""} alt={name} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <span
            className="hidden max-w-40 truncate text-sm sm:inline"
            title={email}
          >
            {email}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.image ?? ""} alt={name} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-bold" title={name}>
                {name}
              </span>
              <span className="truncate text-xs" title={email}>
                {email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/admin?tab=settings">
              <Settings className="mr-2 h-4 w-4" />
              账户设置
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void signOutCleanly();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
