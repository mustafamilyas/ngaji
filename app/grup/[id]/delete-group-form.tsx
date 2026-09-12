"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deleteGroupAction } from "@/app/grup/actions";
import type { ActionResult } from "@/lib/errors";

export function DeleteGroupForm({ groupId }: { groupId: number }) {
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    deleteGroupAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Hapus grup ini? Tindakan ini hanya bisa dilakukan jika grup kosong.")) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Menghapus…" : "Hapus grup"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
