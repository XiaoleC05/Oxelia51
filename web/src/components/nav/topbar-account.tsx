"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOutCleanly } from "@/src/features/auth/lib/signOut";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { cn } from "@/src/utils/tailwind";

/**
 * Compact account affordance for the mobile top bar: the user's avatar opening
 * a small menu (settings, theme, sign out). The sidebar keeps the full NavUser;
 * this is the always-visible shell-level shortcut in the minimal mobile chrome.
 *
 * Oxelia51：主题切换统一收敛到侧边栏 Oxelia51ThemeToggle，此处不再挂载。
 */
export const TopbarAccount = ({ className }: { className?: string }) => {
  const session = useSession();
  const user = session.data?.user;

  if (!user) return null;

  const name = user.name ?? "";
  const email = user.email ?? "";
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() ||
    email[0]?.toUpperCase() ||
    "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-hidden",
          className,
        )}
        aria-label="账户菜单"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} alt={name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="grid text-left text-sm leading-tight">
            <span className="truncate font-bold" title={name}>
              {name}
            </span>
            <span
              className="text-muted-foreground truncate text-xs"
              title={email}
            >
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/settings">账户设置</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            signOutCleanly().catch(() => {});
          }}
        >
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
