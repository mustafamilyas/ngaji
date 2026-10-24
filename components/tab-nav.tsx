import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { tabHref } from "@/lib/tabs";
import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  key: T;
  label: string;
  icon?: LucideIcon;
  /** Shown as a pill after the label (list sizes). */
  count?: number;
  /** Overrides the default `?tab=` link, for pages whose filters apply to every tab (e.g. `/dashboard/statistik`). */
  href?: string;
};

/**
 * Underlined tab strip for detail pages. Tabs are plain links to `?tab=`
 * (see `lib/tabs.ts`), so the server renders only the active tab's data.
 * Scrolls sideways on narrow screens instead of wrapping.
 */
export function TabNav<T extends string>({
  path,
  tabs,
  current,
  defaultTab,
}: {
  path: string;
  tabs: TabItem<T>[];
  current: T;
  defaultTab: T;
}) {
  return (
    <nav aria-label="Bagian halaman" className="-mx-4 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href ?? tabHref(path, tab.key, defaultTab)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium xl:h-10 whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {Icon && <Icon aria-hidden className="size-4" />}
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
