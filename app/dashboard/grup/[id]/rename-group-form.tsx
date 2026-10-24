"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { renameGroupAction } from "@/app/dashboard/grup/actions";
import { touchButton, touchField } from "@/components/ui/touch";
import { cn } from "@/lib/utils";
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          defaultValue={name}
          required
          className={cn(touchField, "sm:flex-1")}
        />
        <Button type="submit" variant="outline" disabled={pending} className={touchButton}>
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
