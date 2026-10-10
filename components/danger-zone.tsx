/**
 * Bordered block that holds a page's irreversible or hard-to-undo actions
 * (end, delete), kept apart from everyday actions so they are never clicked
 * by habit. Each item explains its consequence next to its button.
 */
export function DangerZone({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="danger-zone-title" className="rounded-xl ring-1 ring-destructive/30">
      <h2 id="danger-zone-title" className="border-b border-destructive/20 px-4 py-3 text-sm font-medium text-destructive">
        Zona berbahaya
      </h2>
      <div className="flex flex-col divide-y divide-destructive/10">{children}</div>
    </section>
  );
}

export function DangerZoneItem({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  /** The action form. */
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
