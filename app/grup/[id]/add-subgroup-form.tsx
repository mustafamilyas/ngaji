"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createGroupAction } from "@/app/grup/actions";
import type { ActionResult } from "@/lib/errors";
import type { Group } from "@/lib/generated/prisma/client";

export function AddSubgroupForm({ parentId }: { parentId: number }) {
  const [state, formAction, pending] = useActionState<ActionResult<Group> | null, FormData>(
    createGroupAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="parentId" value={parentId} />
      <div className="flex gap-2">
        <input
          name="name"
          placeholder="Nama sub-grup"
          required
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Tambah"}
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
