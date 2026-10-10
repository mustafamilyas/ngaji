import type { Role } from "@/lib/validation/enums";

/**
 * Which controls the `/pengguna` row offers (DESIGN.md §3.2/§3.4). UI only —
 * every action re-checks on the server through `authorize()`.
 */
export function userRowPermissions(input: {
  viewerRole: Role;
  viewerGroupId: number;
  targetRole: Role;
  targetGroupId: number;
  isSelf: boolean;
}): { canManage: boolean; canReset: boolean } {
  const { viewerRole, viewerGroupId, targetRole, targetGroupId, isSelf } = input;
  return {
    canManage: viewerRole === "OWNER" && !isSelf,
    canReset:
      !isSelf &&
      (viewerRole === "OWNER" || (viewerRole === "ADMIN" && targetRole === "USER" && targetGroupId === viewerGroupId)),
  };
}
