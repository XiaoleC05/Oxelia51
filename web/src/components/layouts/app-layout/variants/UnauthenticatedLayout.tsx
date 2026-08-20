/**
 * Unauthenticated layout variant
 * Used for sign-in, sign-up, and other auth pages
 * Minimal layout with no sidebar or navigation
 */

import type { PropsWithChildren } from "react";
import { SidebarProvider } from "@/src/components/ui/sidebar";

export function UnauthenticatedLayout({ children }: PropsWithChildren) {
  // bg-primary-foreground 在 Oxelia51 双主题下不会随主题翻转（按钮前景色
  // 恒为白），改用语义正确的页面背景色 bg-background。
  return (
    <SidebarProvider className="bg-background">
      <main className="min-h-dvh w-full overflow-y-auto p-3 px-4 py-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </SidebarProvider>
  );
}
