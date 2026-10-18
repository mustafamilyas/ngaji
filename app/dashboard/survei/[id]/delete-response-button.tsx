"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSurveyResponseAction } from "@/app/dashboard/survei/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
        className={buttonVariants({ variant: "ghost", size: "icon" })}
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
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Batal</DialogClose>
          <Button variant="destructive" size="lg" onClick={confirm} disabled={pending}>
            {pending ? "Menghapus…" : "Hapus"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
