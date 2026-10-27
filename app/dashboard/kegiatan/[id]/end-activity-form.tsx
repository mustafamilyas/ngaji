"use client";

import { useActionState, useState } from "react";
import { CalendarX } from "lucide-react";
import { endActivityAction } from "@/app/dashboard/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { touchButton, touchField } from "@/components/ui/touch";
import { endingDeletesActivity } from "@/lib/activity/end";
import { formatDate } from "@/lib/filters";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import type { Activity } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";

export function EndActivityForm({ activityId, startsOn }: { activityId: number; startsOn: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<Activity> | null, FormData>(
    endActivityAction,
    null,
  );
  const submit = useKeepValues(formAction);
  const [fromDate, setFromDate] = useState("");
  // On or before the start date there is nothing to end: the server deletes the activity (DESIGN.md §5).
  const deletes = endingDeletesActivity(startsOn, fromDate);

  return (
    <form
      onSubmit={(event) => {
        const question = deletes
          ? "Kegiatan akan DIHAPUS dari daftar karena tanggal ini sama dengan atau sebelum tanggal mulai. Lanjutkan?"
          : "Akhiri kegiatan ini mulai tanggal yang dipilih?";
        if (!confirm(question)) {
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
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className={touchField}
        />
      </label>
      <Button type="submit" variant={deletes ? "destructive" : "outline"} disabled={pending} className={touchButton}>
        <CalendarX />
        {pending ? "Menyimpan…" : deletes ? "Hapus kegiatan" : "Akhiri"}
      </Button>
      {deletes && (
        <p role="status" className="text-sm text-destructive sm:basis-full">
          Tanggal ini sama dengan atau sebelum tanggal mulai ({formatDate(startsOn)}): kegiatan akan dihapus dari daftar,
          bukan hanya diakhiri.
        </p>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
