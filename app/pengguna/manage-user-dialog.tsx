"use client";

import { useActionState } from "react";
import { KeyRound, Settings2, UserX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { UserGroupRole } from "@/lib/generated/prisma/client";
import type { UserDto } from "@/lib/user/dto";
import type { ActionResult } from "@/lib/errors";
import { ROLES, type Role } from "@/lib/validation/enums";
import { moveUserAction, resetUserPasswordAction, setUserActiveAction, updateUserRoleAction } from "./actions";

const selectClass =
  "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type GroupOption = { id: number; name: string; depth: number };

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
  return (
    <form action={formAction} className="flex flex-col gap-1">
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

function MoveForm({ userId, currentGroupId, groups }: { userId: number; currentGroupId: number; groups: GroupOption[] }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserGroupRole> | null, FormData>(
    moveUserAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <select name="groupId" defaultValue={currentGroupId} className={selectClass}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {"— ".repeat(group.depth)}
              {group.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={pending}>
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
        <p role="status" className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
          Password baru: <code className="font-mono">{state.data.temporaryPassword}</code>
          <span className="block text-xs text-muted-foreground">Catat sekarang — tidak akan ditampilkan lagi.</span>
        </p>
      )}
    </form>
  );
}

/** "Kelola" button on a `/pengguna` row; the page renders it only when `userRowPermissions` allows something. */
export function ManageUserDialog({
  userId,
  userName,
  role,
  groupId,
  isActive,
  canManage,
  canReset,
  groups,
}: {
  userId: number;
  userName: string;
  role: Role;
  groupId: number;
  isActive: boolean;
  canManage: boolean;
  canReset: boolean;
  groups: GroupOption[];
}) {
  return (
    <Dialog>
      <DialogTrigger className={buttonVariants({ variant: "outline" })} aria-label={`Kelola ${userName}`}>
        <Settings2 />
        <span className="hidden sm:inline">Kelola</span>
      </DialogTrigger>
      <DialogContent>
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
      </DialogContent>
    </Dialog>
  );
}
