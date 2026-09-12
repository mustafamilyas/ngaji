"use client";

import { useActionState } from "react";
import { overrideOccurrenceAction } from "@/app/kegiatan/actions";
import { Button } from "@/components/ui/button";
import type { ActivityOccurrence } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";

const inputClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function OccurrenceOverrideForm({
  activityId,
  occurrenceKey,
  isCancelled,
  effectiveDate,
  effectiveStartTime,
  effectiveDurationMinutes,
  effectiveLocation,
  effectiveNotes,
}: {
  activityId: number;
  occurrenceKey: string;
  isCancelled: boolean;
  effectiveDate: string;
  effectiveStartTime: string;
  effectiveDurationMinutes: number;
  effectiveLocation: string;
  effectiveNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult<ActivityOccurrence> | null, FormData>(
    overrideOccurrenceAction,
    null,
  );
  const moved = effectiveDate !== occurrenceKey;

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border p-2 text-xs">
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="date" value={occurrenceKey} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5">
          Status
          <select name="status" defaultValue={isCancelled ? "CANCELLED" : "SCHEDULED"} className={inputClass}>
            <option value="SCHEDULED">Terjadwal</option>
            <option value="CANCELLED">Batal</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          Pindah ke tanggal
          <input
            type="date"
            name="overrideDate"
            defaultValue={moved ? effectiveDate : ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Jam mulai
          <input type="time" name="overrideStartTime" defaultValue={effectiveStartTime} className={inputClass} />
        </label>
        <label className="flex flex-col gap-0.5">
          Durasi (menit)
          <input
            type="number"
            name="overrideDurationMinutes"
            min={1}
            defaultValue={effectiveDurationMinutes}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Lokasi
          <input type="text" name="overrideLocation" defaultValue={effectiveLocation} className={inputClass} />
        </label>
        <label className="flex flex-col gap-0.5">
          Catatan
          <input type="text" name="overrideNotes" defaultValue={effectiveNotes ?? ""} className={inputClass} />
        </label>
      </div>

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan perubahan tanggal ini"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
