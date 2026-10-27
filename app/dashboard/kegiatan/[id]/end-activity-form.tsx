"use client";

import { useActionState } from "react";
import { CalendarX } from "lucide-react";
import { endActivityAction } from "@/app/dashboard/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { touchButton, touchField } from "@/components/ui/touch";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import type { Activity } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";

export function EndActivityForm({ activityId }: { activityId: number }) {
  const [state, formAction, pending] = useActionState<ActionResult<Activity> | null, FormData>(
    endActivityAction,
    null,
  );
  const submit = useKeepValues(formAction);

  return (
    <form
      onSubmit={(event) => {
        if (!confirm("Akhiri kegiatan ini mulai tanggal yang dipilih?")) {
          event.preventDefault();
          return;
        }
        submit(event);
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="activityId" value={activityId} />
      <label className="flex flex-col gap-1 text-sm sm:w-auto">
        Akhiri mulai tanggal
        <input
          type="date"
          name="fromDate"
          required
          className={touchField}
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending} className={touchButton}>
        <CalendarX />
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
