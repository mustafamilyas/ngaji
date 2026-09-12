"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { User, UserGroupRole } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/errors";
import { ROLES, type Role } from "@/lib/validation/enums";
import { moveUserAction, resetUserPasswordAction, setUserActiveAction, updateUserRoleAction } from "./actions";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type GroupOption = { id: number; name: string; depth: number };

function RoleForm({ userId, currentRole }: { userId: number; currentRole: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<UserGroupRole> | null, FormData>(
    updateUserRoleAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-1">
        <select name="role" defaultValue={currentRole} className={selectClass}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "…" : "Ubah peran"}
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
      <div className="flex items-center gap-1">
        <select name="groupId" defaultValue={currentGroupId} className={selectClass}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {"— ".repeat(group.depth)}
              {group.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
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
  const [state, formAction, pending] = useActionState<ActionResult<User> | null, FormData>(
    setUserActiveAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" size="sm" variant={isActive ? "destructive" : "outline"} disabled={pending}>
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
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Reset password"}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-xs">
          Password baru: <code className="font-mono">{state.data.temporaryPassword}</code>
        </p>
      )}
    </form>
  );
}

export function UserRowControls({
  userId,
  role,
  groupId,
  isActive,
  isSelf,
  viewerRole,
  viewerGroupId,
  groups,
}: {
  userId: number;
  role: Role;
  groupId: number;
  isActive: boolean;
  isSelf: boolean;
  viewerRole: Role;
  viewerGroupId: number;
  groups: GroupOption[];
}) {
  const canManage = viewerRole === "OWNER" && !isSelf;
  const canReset =
    !isSelf &&
    (viewerRole === "OWNER" || (viewerRole === "ADMIN" && role === "USER" && groupId === viewerGroupId));

  if (!canManage && !canReset) return null;

  return (
    <div className="flex flex-wrap items-start gap-3 border-t pt-2">
      {canManage && (
        <>
          <RoleForm userId={userId} currentRole={role} />
          <MoveForm userId={userId} currentGroupId={groupId} groups={groups} />
          <ActiveToggleForm userId={userId} isActive={isActive} />
        </>
      )}
      {canReset && <ResetPasswordForm userId={userId} />}
    </div>
  );
}
