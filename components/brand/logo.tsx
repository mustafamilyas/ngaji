import { cn } from "@/lib/utils";

/** Dahan mark: a branch splitting in two ("dahan" = tree branch), echoing the group hierarchy. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      >
        <path d="M16 25V15" />
        <path d="M16 19l-5.5-5.5" />
        <path d="M16 15l5.5-5.5" />
      </g>
      <g className="fill-primary-foreground">
        <circle cx="10" cy="13" r="2" />
        <circle cx="22" cy="9" r="2" />
        <circle cx="16" cy="9.5" r="2" />
      </g>
    </svg>
  );
}
