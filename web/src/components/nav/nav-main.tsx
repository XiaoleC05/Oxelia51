"use client";
import { type LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/src/components/ui/sidebar";
import Link from "next/link";
import { type ReactNode } from "react";
import { type RouteGroup } from "@/src/components/layouts/routes";

export type NavMainItem = {
  title: string;
  menuNode?: ReactNode;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  label?: string | ReactNode;
  newTab?: boolean;
  group?: RouteGroup;
  items?: {
    title: string;
    url: string;
    isActive?: boolean;
    newTab?: boolean;
  }[];
};

function NavItemContent({ item }: { item: NavMainItem }) {
  return (
    <>
      {item.icon && <item.icon />}
      <span>{item.title}</span>
      {item.label &&
        (typeof item.label === "string" ? (
          <span className="-my-0.5 self-center rounded-sm border px-1 py-0.5 text-xs leading-none break-keep whitespace-nowrap">
            {item.label}
          </span>
        ) : (
          // ReactNode
          item.label
        ))}
    </>
  );
}

function NavItem({ item }: { item: NavMainItem }) {
  return (
    <SidebarMenuItem>
      {item.menuNode || (
        <SidebarMenuButton
          asChild
          tooltip={item.title}
          isActive={item.isActive}
        >
          <Link href={item.url} target={item.newTab ? "_blank" : undefined}>
            <NavItemContent item={item} />
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

/**
 * 渲染块：连续的无分组条目合成一个块，同名分组连续出现合成一个分组块。
 * 顺序完全由 ROUTES 声明顺序（flattened）驱动。
 */
type NavBlock =
  | { kind: "items"; items: NavMainItem[] }
  | { kind: "group"; group: RouteGroup; items: NavMainItem[] };

function buildNavBlocks(flattened: NavMainItem[]): NavBlock[] {
  const blocks: NavBlock[] = [];

  for (const item of flattened) {
    const last = blocks[blocks.length - 1];
    if (item.group) {
      if (last?.kind === "group" && last.group === item.group) {
        last.items.push(item);
      } else {
        blocks.push({ kind: "group", group: item.group, items: [item] });
      }
    } else {
      if (last?.kind === "items") {
        last.items.push(item);
      } else {
        blocks.push({ kind: "items", items: [item] });
      }
    }
  }

  return blocks;
}

export function NavMain({
  items,
}: {
  items: {
    grouped: Partial<Record<RouteGroup, NavMainItem[]>> | null;
    ungrouped: NavMainItem[];
    flattened: NavMainItem[];
  };
}) {
  const blocks = buildNavBlocks(items.flattened);

  return (
    <>
      {blocks.map((block) => {
        switch (block.kind) {
          case "items":
            return (
              <SidebarGroup key={`items:${block.items[0]?.title ?? ""}`}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {block.items.map((item) => (
                      <NavItem key={item.title} item={item} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          case "group":
            return (
              <SidebarGroup key={block.group}>
                <SidebarGroupLabel>{block.group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {block.items.map((item) => (
                      <NavItem key={item.title} item={item} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
        }
      })}
    </>
  );
}
