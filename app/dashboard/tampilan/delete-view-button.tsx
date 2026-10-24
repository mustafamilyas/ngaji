"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMemberViewAction } from "@/app/dashboard/tampilan/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { touchLgButton } from "@/components/ui/touch";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Danger-zone button that confirms in a dialog before soft-deleting the view. */
export function DeleteViewButton({ viewId, viewName }: { viewId: number; viewName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteMemberViewAction({ viewId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/tampilan");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "destructive", size: "lg" }), touchLgButton)}>Hapus tampilan</DialogTrigger>
      <DialogContent>
        <DialogTitle>Hapus tampilan?</DialogTitle>
        <DialogDescription>
          Tampilan &quot;{viewName}&quot; akan hilang dari daftar. Tindakan ini tercatat di log audit.
        </DialogDescription>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className={cn(buttonVariants({ variant: "outline", size: "lg" }), touchLgButton)}>Batal</DialogClose>
          <Button variant="destructive" size="lg" className={touchLgButton} onClick={confirm} disabled={pending}>
            {pending ? "Menghapus…" : "Hapus"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
