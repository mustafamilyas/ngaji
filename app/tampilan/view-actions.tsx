"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Pencil, Save, Undo2, UserCheck } from "lucide-react";
import {
  createMemberViewAction,
  transferMemberViewAction,
  updateMemberViewAction,
} from "@/app/tampilan/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/errors";
import type { Definition } from "@/lib/validation/member-view";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Dialog with one name field; `onSubmit` returns the server action's result so errors show inline. */
function NameDialog({
  trigger,
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<ActionResult<unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await onSubmit(name);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(initialName);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "lg" })}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="view-name" className="text-sm font-medium">
              Nama
            </label>
            <input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonVariants({ variant: "ghost", size: "lg" })}>Batal</DialogClose>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Menyimpan…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header actions of a view page (secondary → primary). Which buttons exist is
 * decided by the server component from ownership and role; the server actions
 * re-authorize every call, so hiding a button is only a convenience.
 */
export function ViewActions({
  viewId,
  viewName,
  definition,
  basePath,
  isDraft,
  isOwner,
  canTransfer,
}: {
  viewId: number | null;
  viewName: string;
  definition: Definition;
  basePath: string;
  isDraft: boolean;
  isOwner: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function run(action: () => Promise<ActionResult<unknown>>, after: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) after();
      else setError(result.error);
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
      {canTransfer && (
        <Button
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() =>
            run(
              () => transferMemberViewAction({ viewId }),
              () => router.refresh(),
            )
          }
        >
          <UserCheck />
          Ambil alih
        </Button>
      )}
      {isOwner && viewId !== null && (
        <NameDialog
          trigger={
            <>
              <Pencil />
              Ubah nama
            </>
          }
          title="Ubah nama tampilan"
          description="Nama harus unik di grup Anda."
          initialName={viewName}
          submitLabel="Simpan"
          onSubmit={async (name) => {
            const result = await updateMemberViewAction({ viewId, name });
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      <NameDialog
        trigger={
          <>
            <Copy />
            Simpan sebagai baru
          </>
        }
        title="Simpan sebagai tampilan baru"
        description="Tampilan baru ini menjadi milik Anda di grup Anda."
        initialName=""
        submitLabel="Simpan"
        onSubmit={async (name) => {
          const result = await createMemberViewAction({ name, definition });
          if (result.ok) router.push(`/tampilan/${result.data.id}`);
          return result;
        }}
      />
      {isOwner && viewId !== null && isDraft && (
        <>
          <Button variant="ghost" size="lg" disabled={pending} onClick={() => router.replace(basePath, { scroll: false })}>
            <Undo2 />
            Batalkan
          </Button>
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              run(
                () => updateMemberViewAction({ viewId, definition }),
                () => router.replace(basePath, { scroll: false }),
              )
            }
          >
            <Save />
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      )}
    </>
  );
}
