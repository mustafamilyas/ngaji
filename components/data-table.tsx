import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/sort";

/**
 * Card around a list table: a heading row (count on the left, toolbar such as
 * filters on the right), the table, and an optional footer for the pager.
 */
export function TableCard({
  title,
  toolbar,
  footer,
  children,
}: {
  title: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-muted-foreground">{title}</div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>
      {children}
      {footer && <div className="border-t px-4 py-3">{footer}</div>}
    </section>
  );
}

export const tableClass = "w-full text-sm";
export const theadRowClass = "border-b bg-muted/50 text-left text-xs text-muted-foreground";
export const thClass = "px-4 py-2.5 font-medium whitespace-nowrap";
export const tdClass = "px-4 py-2.5 whitespace-nowrap";
export const trClass = "group/row border-b last:border-0 hover:bg-muted/50";

/** Arrow for a sortable column: both ways when inactive, the direction when active. */
export function SortIcon({ dir }: { dir?: SortDir }) {
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronsUpDown;
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", !dir && "opacity-50")} />;
}

/** Header cell that sorts the list by linking to `href` (see `lib/sort.ts`). */
export function SortableTh({
  label,
  href,
  dir,
  align = "left",
  className,
}: {
  label: string;
  href: string;
  /** Set on the active column only. */
  dir?: SortDir;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
      className={cn(thClass, align === "right" && "text-right", className)}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground",
          dir && "text-foreground",
        )}
      >
        {label}
        <SortIcon dir={dir} />
      </Link>
    </th>
  );
}

/** Headline figures above a list ("Total anggota 134"). */
export function StatTiles({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10 lg:grid-cols-4">
      {children}
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
