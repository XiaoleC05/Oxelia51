/**
 * Minimal layout variant
 * Used for onboarding, public routes, and other pages without navigation
 * Similar to unauthenticated but semantically different use case
 */

import type { PropsWithChildren } from "react";
import { SidebarProvider } from "@/src/components/ui/sidebar";
import { FilingInfo } from "@/src/components/FilingInfo";

export function MinimalLayout({ children }: PropsWithChildren) {
  // bg-primary-foreground 在 Oxelia51 双主题下不会随主题翻转（按钮前景色
  // 恒为白），改用语义正确的页面背景色 bg-background。
  return (
    <SidebarProvider className="bg-background">
      <main className="min-h-dvh w-full overflow-y-auto p-3 px-4 py-4 sm:px-6 lg:px-8">
        {children}
      </main>
      {/* Oxelia51 备案信息 + 开源声明 */}
      <footer className="bg-background fixed inset-x-0 bottom-0 border-t py-1.5">
        <FilingInfo variant="full" />
      </footer>
    </SidebarProvider>
  );
}
