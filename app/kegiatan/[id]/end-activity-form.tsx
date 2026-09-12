"use client";

import { useActionState } from "react";
import { endActivityAction } from "@/app/kegiatan/actions";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";

export function EndActivityForm({ activityId }: { activityId: number }) {
  const [state, formAction, pending] = useActionState<ActionResult<Activity> | null, FormData>(
    endActivityAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Akhiri kegiatan ini mulai tanggal yang dipilih?")) {
          event.preventDefault();
        }
      }}
      className="flex items-end gap-2"
    >
      <input type="hidden" name="activityId" value={activityId} />
      <label className="flex flex-col gap-1 text-sm">
        Akhiri mulai tanggal
        <input
          type="date"
          name="fromDate"
          required
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Menyimpan…" : "Akhiri"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
