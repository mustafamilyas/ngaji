"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import type { Level } from "@/lib/generated/prisma/client";
import { renameLevelAction } from "./actions";

export function RenameLevelForm({ depth, name }: { depth: number; name: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<Level> | null, FormData>(
    renameLevelAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="depth" value={depth} />
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Jenjang {depth}</span>
        <input
          name="name"
          defaultValue={name}
          required
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
