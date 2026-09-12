"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { renameGroupAction } from "@/app/grup/actions";
import type { ActionResult } from "@/lib/errors";
import type { Group } from "@/lib/generated/prisma/client";

export function RenameGroupForm({ groupId, name }: { groupId: number; name: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<Group> | null, FormData>(
    renameGroupAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex gap-2">
        <input
          name="name"
          defaultValue={name}
          required
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Menyimpan…" : "Ganti nama"}
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
