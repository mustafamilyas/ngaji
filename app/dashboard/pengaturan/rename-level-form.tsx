"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { touchField } from "@/components/ui/touch";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/errors";
import type { Level } from "@/lib/generated/prisma/client";
import { renameLevelAction } from "./level-actions";

export function RenameLevelForm({ depth, name }: { depth: number; name: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<Level> | null, FormData>(
    renameLevelAction,
    null,
  );
  const onSubmit = useKeepValues(formAction);

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-2">
      <input type="hidden" name="depth" value={depth} />
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
          {depth + 1}
        </span>
        <input
          name="name"
          defaultValue={name}
          aria-label={`Nama jenjang ${depth + 1}`}
          required
          className={cn(touchField, "min-w-0 flex-1")}
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
