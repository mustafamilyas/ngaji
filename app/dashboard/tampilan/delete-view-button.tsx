"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMemberViewAction } from "@/app/dashboard/tampilan/actions";
import { Button, buttonVariants } from "@/components/ui/button";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
      <DialogTrigger className={buttonVariants({ variant: "destructive", size: "lg" })}>Hapus tampilan</DialogTrigger>
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
        <DialogFooter className="mt-5">
          <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Batal</DialogClose>
          <Button variant="destructive" size="lg" onClick={confirm} disabled={pending}>
            {pending ? "Menghapus…" : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
