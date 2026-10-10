import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/** Where the page sits: section root first, current page last (not a link). */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="inline-flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="truncate transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "text-foreground")}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** One fact under a page title: an icon plus short text (schedule, place, group…). */
export function MetaItem({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className="size-4 shrink-0" />
      {children}
    </span>
  );
}

/**
 * Header shared by every detail page: breadcrumb, title (+ badges), a row of
 * meta facts, and the page's actions on the right (below the title on phones).
 * Actions are ordered secondary → primary; destructive actions never go here,
 * they live in the page's danger zone.
 */
export function PageHeader({
  breadcrumb,
  title,
  badges,
  meta,
  actions,
}: {
  breadcrumb?: Crumb[];
  title: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
            {badges}
          </div>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">{meta}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
