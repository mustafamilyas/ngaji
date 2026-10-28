"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Settings2, UserX } from "lucide-react";
import { GroupAutocomplete, withParentNames } from "@/components/group-autocomplete";
import { Button, buttonVariants } from "@/components/ui/button";
import { touchField } from "@/components/ui/touch";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { UserExtraRole, UserGroupRole } from "@/lib/generated/prisma/client";
import type { UserDto } from "@/lib/user/dto";
import type { ActionResult } from "@/lib/errors";
import { ROLES, type Role } from "@/lib/validation/enums";
import { addExtraRoleAction, moveUserAction, removeExtraRoleAction, resetUserPasswordAction, setUserActiveAction, updateUserRoleAction } from "./actions";

const selectClass = cn(touchField, "min-w-0 flex-1");

type GroupOption = { id: number; name: string; parentId: number | null };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function RoleForm({ userId, currentRole }: { userId: number; currentRole: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserGroupRole> | null, FormData>(
    updateUserRoleAction,
    null,
  );
  const onSubmit = useKeepValues(formAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <select name="role" defaultValue={currentRole} className={selectClass}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "…" : "Simpan"}
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

type ExtraRoleRow = { groupId: number; groupName: string };

function RemoveExtraRoleForm({ userId, groupId, groupName }: { userId: number; groupId: number; groupName: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserExtraRole> | null, FormData>(
    removeExtraRoleAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm">
          ADMIN di <strong>{groupName}</strong>
        </span>
        <Button type="submit" variant="outline" disabled={pending} aria-label={`Hapus peran ADMIN di ${groupName}`}>
          {pending ? "…" : "Hapus"}
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function AddExtraRoleForm({ userId, groups }: { userId: number; groups: GroupOption[] }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserExtraRole> | null, FormData>(
    addExtraRoleAction,
    null,
  );
  const [groupId, setGroupId] = useState<number | undefined>();
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

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <GroupAutocomplete
            key={pickerKey}
            id={`extra-role-group-${userId}`}
            label="Tambah ADMIN di grup"
            groups={groupOptions}
            value={groupId}
            onChange={setGroupId}
            name="groupId"
            inlineList
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending || groupId === undefined}>
          {pending ? "…" : "Tambah"}
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function MoveForm({ userId, currentGroupId, groups }: { userId: number; currentGroupId: number; groups: GroupOption[] }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserGroupRole> | null, FormData>(
    moveUserAction,
    null,
  );
  const [groupId, setGroupId] = useState<number | undefined>(currentGroupId);
  const groupOptions = useMemo(() => withParentNames(groups), [groups]);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <GroupAutocomplete
            id={`move-user-group-${userId}`}
            label="Pindah ke grup"
            groups={groupOptions}
            value={groupId}
            onChange={setGroupId}
            name="groupId"
            inlineList
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={pending || groupId === undefined || groupId === currentGroupId}
        >
          {pending ? "…" : "Pindahkan"}
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ActiveToggleForm({ userId, isActive }: { userId: number; isActive: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserDto> | null, FormData>(
    setUserActiveAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" variant={isActive ? "destructive" : "outline"} disabled={pending} className="self-start">
        {isActive && <UserX />}
        {pending ? "…" : isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ temporaryPassword: string }> | null,
    FormData
  >(resetUserPasswordAction, null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  // On a short screen the dialog scrolls, and the password must be noted down now: bring it into view.
  useEffect(() => {
    if (state?.ok) resultRef.current?.scrollIntoView({ block: "nearest" });
  }, [state]);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        <KeyRound />
        {pending ? "…" : "Reset password"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p
          ref={resultRef}
          role="status"
          className="scroll-mb-20 rounded-md border border-primary/30 bg-primary/5 p-2 text-sm"
        >
          Password baru: <code className="font-mono">{state.data.temporaryPassword}</code>
          <span className="block text-xs text-muted-foreground">Catat sekarang — tidak akan ditampilkan lagi.</span>
        </p>
      )}
    </form>
  );
}

/** "Kelola" button on a `/dashboard/pengguna` row; the page renders it only when `userRowPermissions` allows something. */
export function ManageUserDialog({
  userId,
  userName,
  role,
  groupId,
  isActive,
  canManage,
  canReset,
  groups,
  extraRoles,
}: {
  userId: number;
  userName: string;
  role: Role;
  groupId: number;
  isActive: boolean;
  canManage: boolean;
  canReset: boolean;
  groups: GroupOption[];
  extraRoles: ExtraRoleRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "h-11 min-w-11 xl:h-8 xl:min-w-0")} aria-label={`Kelola ${userName}`}>
        <Settings2 />
        <span className="hidden sm:inline">Kelola</span>
      </DialogTrigger>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        <DialogTitle>{userName}</DialogTitle>
        <DialogDescription>Setiap perubahan tercatat di log audit.</DialogDescription>
        <div className="mt-4 flex flex-col divide-y">
          {canManage && (
            <>
              <Section title="Peran">
                <RoleForm userId={userId} currentRole={role} />
              </Section>
              <Section title="Grup">
                <MoveForm userId={userId} currentGroupId={groupId} groups={groups} />
              </Section>
              <Section
                title="Peran tambahan"
                description="ADMIN di grup di bawah grup utama, misalnya pengguna yang hanya USER di grup utamanya. Cakupan data tidak berubah."
              >
                {extraRoles.map((extra) => (
                  <RemoveExtraRoleForm key={extra.groupId} userId={userId} groupId={extra.groupId} groupName={extra.groupName} />
                ))}
                <AddExtraRoleForm
                  userId={userId}
                  groups={groups.filter((g) => g.id !== groupId && !extraRoles.some((e) => e.groupId === g.id))}
                />
              </Section>
            </>
          )}
          {canReset && (
            <Section title="Password" description="Membuat password sementara; pengguna wajib menggantinya saat masuk.">
              <ResetPasswordForm userId={userId} />
            </Section>
          )}
          {canManage && (
            <Section
              title={isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
              description={isActive ? "Pengguna langsung keluar dan tidak bisa masuk lagi sampai diaktifkan." : undefined}
            >
              <ActiveToggleForm userId={userId} isActive={isActive} />
            </Section>
          )}
        </div>
        <DialogFooter className="mt-4">
          <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
