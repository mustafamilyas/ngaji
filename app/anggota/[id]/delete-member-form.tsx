"use client";

import { useActionState } from "react";
import { deleteMemberAction } from "@/app/anggota/actions";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function DeleteMemberForm({ memberId }: { memberId: number }) {
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    deleteMemberAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Hapus anggota ini?")) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="memberId" value={memberId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Menghapus…" : "Hapus anggota"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
