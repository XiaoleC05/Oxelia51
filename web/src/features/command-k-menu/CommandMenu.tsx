import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/src/components/ui/command";
import { useRouter } from "next/router";
import { useEffect, memo } from "react";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { useDebounce } from "@/src/hooks/useDebounce";
import { useCommandMenu } from "@/src/features/command-k-menu/CommandMenuProvider";
import { useAccountSettingsPages } from "@/src/pages/account/settings";
import { type NavigationItem } from "@/src/components/layouts/utilities/routes";

function MainNavigationGroup({
  navItems,
  onNavigate,
}: {
  navItems: Array<{ title: string; url: string }>;
  onNavigate: (item: { title: string; url: string }) => void;
}) {
  const router = useRouter();
  const capture = usePostHogClientCapture();

  return (
    <CommandGroup heading="主导航">
      {navItems.map((item) => (
        <CommandItem
          key={item.url}
          value={item.url}
          keywords={[item.title]}
          onSelect={() => {
            router.push(item.url);
            capture("cmd_k_menu:navigated", {
              type: "main_navigation",
              title: item.title,
              url: item.url,
            });
            onNavigate(item);
          }}
        >
          {item.title}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function AccountSettingsGroup({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const capture = usePostHogClientCapture();
  const accountSettingsPages = useAccountSettingsPages();

  const accountSettingsItems = accountSettingsPages.map((page) => ({
    title: `账户设置 > ${page.title}`,
    url: `/account/settings${page.slug === "index" ? "" : `/${page.slug}`}`,
    keywords: page.cmdKKeywords || [],
  }));

  if (accountSettingsItems.length === 0) return null;

  return (
    <>
      <CommandSeparator />
      <CommandGroup heading="账户设置">
        {accountSettingsItems.map((item) => (
          <CommandItem
            key={item.url}
            value={item.title}
            keywords={item.keywords}
            onSelect={() => {
              router.push(item.url);
              capture("cmd_k_menu:navigated", {
                type: "account_settings",
                title: item.title,
                url: item.url,
              });
              onNavigate();
            }}
          >
            {item.title}
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

function CommandMenuComponent({
  mainNavigation,
}: {
  mainNavigation: NavigationItem[];
}) {
  const { open, setOpen } = useCommandMenu();
  const capture = usePostHogClientCapture();

  const debouncedSearchChange = useDebounce(
    (value: string) => {
      capture("cmd_k_menu:search_entered", {
        search: value,
      });
    },
    500,
    false,
  );

  const navItems = mainNavigation
    .flatMap((item) => {
      if (item.items) {
        // if the item has children, return the children and not the parent
        return item.items.map((child) => ({
          title: `${item.title} > ${child.title}`,
          url: child.url,
        }));
      }
      return [
        {
          title: item.title,
          url: item.url,
        },
      ];
    })
    .filter((item) => Boolean(item.url) && !item.url.includes("["));

  // Keyboard shortcut effect
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!open) {
          capture("cmd_k_menu:opened", {
            source: "cmd_k",
          });
        }
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [capture, setOpen, open]);

  const handleNavigate = () => {
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      filter={(value, search, keywords) => {
        const extendValue = value + " " + keywords?.join(" ");
        const searchTerms = search.toLowerCase().split(" ");
        return searchTerms.every((term) =>
          extendValue.toLowerCase().includes(term),
        )
          ? 1
          : 0;
      }}
    >
      <CommandInput
        placeholder="输入命令或搜索..."
        className="border-none focus:border-none focus:ring-0 focus:ring-transparent focus:outline-hidden"
        onValueChange={debouncedSearchChange}
      />
      <CommandList>
        <CommandEmpty>未找到结果。</CommandEmpty>
        <MainNavigationGroup navItems={navItems} onNavigate={handleNavigate} />
        <AccountSettingsGroup onNavigate={handleNavigate} />
      </CommandList>
    </CommandDialog>
  );
}

export const CommandMenu = memo(
  CommandMenuComponent,
  (prevProps, nextProps) => {
    // Only re-render if mainNavigation titles or urls change
    if (prevProps.mainNavigation.length !== nextProps.mainNavigation.length) {
      return false;
    }

    const isSame = prevProps.mainNavigation.every((item, idx) => {
      const nextItem = nextProps.mainNavigation[idx];
      const itemTitleUrl =
        item.title === nextItem.title && item.url === nextItem.url;

      if (!itemTitleUrl) {
        return false;
      }

      // Check children if they exist
      if (item.items && nextItem.items) {
        if (item.items.length !== nextItem.items.length) {
          return false;
        }
        const childrenMatch = item.items.every((child, childIdx) => {
          const nextChild = nextItem.items![childIdx];
          const match =
            child.title === nextChild.title && child.url === nextChild.url;
          return match;
        });
        return itemTitleUrl && childrenMatch;
      }

      if ((item.items || nextItem.items) && !(item.items && nextItem.items)) {
        return false;
      }

      return itemTitleUrl && !item.items && !nextItem.items;
    });

    return isSame;
  },
);
