import { OCCURRENCE_NOTES_EXPAND_FROM } from "@/lib/constants";

/**
 * Keterangan of one occurrence under its activity name in the list. Always plain text (React
 * escapes it). Long notes are clamped to two lines and open in full by tap through a native
 * <details>, so it needs no client JS and works without hover; short ones are plain text.
 */
export function OccurrenceNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;
  const textClass = "max-w-xs text-xs break-words whitespace-pre-line text-muted-foreground";

  if (notes.length < OCCURRENCE_NOTES_EXPAND_FROM && !notes.includes("\n")) {
    return (
      <span data-occurrence-notes className={`mt-0.5 block ${textClass}`}>
        {notes}
      </span>
    );
  }

  return (
    // The browser adds `open` when the summary is tapped before React has hydrated; that is the only mismatch,
    // it is harmless, and React only reports it in development (task 10.28).
    <details data-occurrence-notes suppressHydrationWarning className="group mt-0.5 max-w-xs text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none rounded-sm outline-offset-2 focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
        <span className={`${textClass} line-clamp-2 group-open:line-clamp-none`}>{notes}</span>
        <span className="inline-flex min-h-6 items-center text-primary group-open:hidden">Selengkapnya</span>
        <span className="hidden min-h-6 items-center text-primary group-open:inline-flex">Ringkas</span>
      </summary>
    </details>
  );
}
