"use client";

import { useActionState } from "react";
import { deleteActivityAction } from "@/app/kegiatan/actions";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function DeleteActivityForm({ activityId }: { activityId: number }) {
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    deleteActivityAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Hapus kegiatan ini? Riwayat absensi tetap tersimpan.")) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="activityId" value={activityId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Menghapus…" : "Hapus kegiatan"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
