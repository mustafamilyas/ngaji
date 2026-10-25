import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow, totalPagesFor } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const itemClass =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-base transition-colors xl:h-8 xl:min-w-8 xl:text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Pager for every list: "1–50 dari 120" plus page buttons; renders nothing
 * for a single page. Server pages pass `hrefFor` (plain links, so paging
 * works without JS and keeps the URL shareable); client-sorted tables pass
 * `onPageChange` instead. Not a client component itself, so either kind of
 * parent can render it.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  onPageChange,
  scroll = true,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  /** For lists embedded in a detail page, pass false so paging keeps the reader's place. */
  scroll?: boolean;
  className?: string;
}) {
  const totalPages = totalPagesFor(total, pageSize);
  // A single page needs no pager; lists show their own count/empty state.
  if (totalPages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function control(
    target: number,
    children: React.ReactNode,
    props: { label: string; current?: boolean; className?: string },
  ) {
    const disabled = target < 1 || target > totalPages;
    const classes = cn(
      itemClass,
      props.current ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
      disabled && "pointer-events-none opacity-40",
      props.className,
    );
    if (disabled || props.current) {
      return (
        <span
          aria-label={props.label}
          aria-current={props.current ? "page" : undefined}
          aria-disabled={disabled || undefined}
          className={classes}
        >
          {children}
        </span>
      );
    }
    if (hrefFor) {
      return (
        <Link href={hrefFor(target)} scroll={scroll} aria-label={props.label} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onPageChange?.(target)} aria-label={props.label} className={classes}>
        {children}
      </button>
    );
  }

  return (
    <nav aria-label="Paginasi" className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <p className="text-sm text-muted-foreground">
        {first === last ? first : `${first}–${last}`} dari {total}
      </p>
      <div className="flex items-center gap-1">
        {control(page - 1, <ChevronLeft className="size-4" />, { label: "Halaman sebelumnya" })}
        {pageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} aria-hidden className="hidden px-1 text-muted-foreground sm:inline">
              …
            </span>
          ) : (
            <span key={item} className="hidden sm:contents">
              {control(item, item, { label: `Halaman ${item}`, current: item === page })}
            </span>
          ),
        )}
        <span className="px-2 text-sm text-muted-foreground sm:hidden">
          {page} / {totalPages}
        </span>
        {control(page + 1, <ChevronRight className="size-4" />, { label: "Halaman berikutnya" })}
      </div>
    </nav>
  );
}
