"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createGroupAction } from "@/app/dashboard/grup/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { touchField, touchLgButton } from "@/components/ui/touch";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import { cn } from "@/lib/utils";
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
  const onSubmit = useKeepValues(formAction);
  const noun = childLevelName || "sub-grup";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: "lg" }), touchLgButton)}>
        <Plus />
        Tambah {noun.toLowerCase()}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Tambah {noun.toLowerCase()}</DialogTitle>
        <DialogDescription>Akan dibuat di bawah {parentName}.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
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
              className={touchField}
            />
          </div>
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "ghost", size: "lg" }), touchLgButton)}>Batal</DialogClose>
            <Button type="submit" size="lg" disabled={pending} className={touchLgButton}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
