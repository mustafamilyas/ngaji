"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSurveyResponseAction } from "@/app/dashboard/survei/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { touchIconButton, touchLgButton } from "@/components/ui/touch";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Trash button that asks for confirmation before removing one member's response. */
export function DeleteResponseButton({
  surveyId,
  memberId,
  memberName,
}: {
  surveyId: number;
  memberId: number;
  memberName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteSurveyResponseAction({ surveyId, memberId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Hapus respons ${memberName}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), touchIconButton)}
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Hapus respons?</DialogTitle>
        <DialogDescription>
          Jawaban {memberName} untuk survei ini akan dihapus permanen. Tindakan ini tercatat di log audit.
        </DialogDescription>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="mt-5">
          <DialogClose className={cn(buttonVariants({ variant: "outline", size: "lg" }), touchLgButton)}>Batal</DialogClose>
          <Button variant="destructive" size="lg" className={touchLgButton} onClick={confirm} disabled={pending}>
            {pending ? "Menghapus…" : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
