"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { overrideOccurrenceAction } from "@/app/dashboard/kegiatan/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { touchIconButton } from "@/components/ui/touch";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActivityOccurrence } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";
import { formatDate } from "@/lib/filters";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Cancel, move or retime a single occurrence ("hanya tanggal ini"), from a row of the schedule. */
export function OccurrenceOverrideDialog({
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
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult<ActivityOccurrence> | null, FormData>(
    async (prev, formData) => {
      const result = await overrideOccurrenceAction(prev, formData);
      if (result.ok) setOpen(false);
      return result;
    },
    null,
  );
  const moved = effectiveDate !== occurrenceKey;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Ubah jadwal ${formatDate(effectiveDate)}`}
        title="Ubah tanggal ini"
        className={buttonVariants({ variant: "ghost", size: "icon", className: touchIconButton })}
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Ubah tanggal ini</DialogTitle>
        <DialogDescription>
          Hanya berlaku untuk jadwal {formatDate(occurrenceKey)}; jadwal lain tidak berubah.
        </DialogDescription>
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="activityId" value={activityId} />
          <input type="hidden" name="date" value={occurrenceKey} />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1 font-medium">
              Status
              <select name="status" defaultValue={isCancelled ? "CANCELLED" : "SCHEDULED"} className={inputClass}>
                <option value="SCHEDULED">Terjadwal</option>
                <option value="CANCELLED">Batal</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Pindah ke tanggal
              <input type="date" name="overrideDate" defaultValue={moved ? effectiveDate : ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Jam mulai
              <input type="time" name="overrideStartTime" defaultValue={effectiveStartTime} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Durasi (menit)
              <input
                type="number"
                name="overrideDurationMinutes"
                min={1}
                defaultValue={effectiveDurationMinutes}
                className={inputClass}
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 font-medium">
              Lokasi
              <input type="text" name="overrideLocation" defaultValue={effectiveLocation} className={inputClass} />
            </label>
            <label className="col-span-2 flex flex-col gap-1 font-medium">
              Catatan
              <input type="text" name="overrideNotes" defaultValue={effectiveNotes ?? ""} className={inputClass} />
            </label>
          </div>

          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonVariants({ variant: "ghost", size: "lg" })}>Tutup</DialogClose>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
