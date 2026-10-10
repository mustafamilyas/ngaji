"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createGroupAction } from "@/app/grup/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/errors";
import type { Group } from "@/lib/generated/prisma/client";

export function AddSubgroupDialog({
  parentId,
  parentName,
  childLevelName,
}: {
  parentId: number;
  parentName: string;
  /** Level the new group lands on ("Kelompok"), for the labels. */
  childLevelName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult<Group> | null, FormData>(
    async (prev, formData) => {
      const result = await createGroupAction(prev, formData);
      if (result.ok) setOpen(false);
      return result;
    },
    null,
  );
  const noun = childLevelName || "sub-grup";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ size: "lg" })}>
        <Plus />
        Tambah {noun.toLowerCase()}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Tambah {noun.toLowerCase()}</DialogTitle>
        <DialogDescription>Akan dibuat di bawah {parentName}.</DialogDescription>
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="parentId" value={parentId} />
          <div className="flex flex-col gap-1">
            <label htmlFor="subgroup-name" className="text-sm font-medium">
              Nama
            </label>
            <input
              id="subgroup-name"
              name="name"
              required
              autoFocus
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonVariants({ variant: "ghost", size: "lg" })}>Batal</DialogClose>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
