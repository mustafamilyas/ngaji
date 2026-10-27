"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { GroupAutocomplete, withParentNames } from "@/components/group-autocomplete";
import { Button, buttonVariants } from "@/components/ui/button";
import { touchButton, touchField } from "@/components/ui/touch";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { CreatedUserDto } from "@/lib/user/dto";
import type { ActionResult } from "@/lib/errors";
import type { Role } from "@/lib/validation/enums";
import { createUserAction } from "./actions";

const inputClass = touchField;

type GroupOption = { id: number; name: string; parentId: number | null };

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** "Tambah pengguna" header action; the dialog stays open after success so the temporary password can be noted. */
export function CreateUserDialog({
  groups,
  allowedRoles,
}: {
  groups: GroupOption[];
  allowedRoles: readonly Role[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ user: CreatedUserDto; temporaryPassword: string }> | null,
    FormData
  >(createUserAction, null);
  const onSubmit = useKeepValues(formAction);
  const formRef = useRef<HTMLFormElement>(null);
  const [groupId, setGroupId] = useState<number | undefined>();
  // Remounting the picker clears its text after a successful create.
  const [pickerKey, setPickerKey] = useState(0);
  const groupOptions = useMemo(() => withParentNames(groups), [groups]);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) {
      setGroupId(undefined);
      setPickerKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger className={cn(buttonVariants({ size: "lg" }), "h-11 w-full text-base sm:w-auto xl:h-9 xl:text-sm")}>
        <UserPlus />
        Tambah pengguna
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Tambah pengguna</DialogTitle>
        <DialogDescription>Password sementara dibuat otomatis dan wajib diganti saat pertama masuk.</DialogDescription>

        <form ref={formRef} onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <GroupAutocomplete
            key={pickerKey}
            id="new-user-group"
            groups={groupOptions}
            value={groupId}
            onChange={setGroupId}
            name="groupId"
          />
          <Field label="Nama" htmlFor="new-user-name">
            <input id="new-user-name" name="name" required className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Username" htmlFor="new-user-username">
              <input id="new-user-username" name="username" required className={inputClass} />
            </Field>
            <Field label="Peran" htmlFor="new-user-role">
              <select id="new-user-role" name="role" required className={inputClass}>
                {allowedRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <div role="status" className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p>
                Pengguna <strong>{state.data.user.username}</strong> dibuat.
              </p>
              <p className="mt-1">
                Password sementara: <code className="font-mono">{state.data.temporaryPassword}</code>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Catat sekarang — password ini tidak akan ditampilkan lagi.
              </p>
            </div>
          )}

          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "ghost", size: "lg" }), touchButton)}>Tutup</DialogClose>
            <Button type="submit" size="lg" className={touchButton} disabled={pending || groupId === undefined}>
              {pending ? "Menyimpan…" : "Buat pengguna"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
