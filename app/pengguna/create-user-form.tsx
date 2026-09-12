"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";
import type { Role } from "@/lib/validation/enums";
import { createUserAction } from "./actions";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type GroupOption = { id: number; name: string; depth: number };

export function CreateUserForm({
  groups,
  allowedRoles,
}: {
  groups: GroupOption[];
  allowedRoles: readonly Role[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ user: User; temporaryPassword: string }> | null,
    FormData
  >(createUserAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-md border p-3">
      <h2 className="text-sm font-medium">Tambah pengguna</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-group" className="text-xs text-muted-foreground">
          Grup
        </label>
        <select id="new-user-group" name="groupId" required className={inputClass}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {"— ".repeat(group.depth)}
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-name" className="text-xs text-muted-foreground">
          Nama
        </label>
        <input id="new-user-name" name="name" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-username" className="text-xs text-muted-foreground">
          Username
        </label>
        <input id="new-user-username" name="username" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-role" className="text-xs text-muted-foreground">
          Peran
        </label>
        <select id="new-user-role" name="role" required className={inputClass}>
          {allowedRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Buat pengguna"}
      </Button>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <div role="status" className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
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
    </form>
  );
}
