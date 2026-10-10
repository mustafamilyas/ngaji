import { describe, expect, it } from "vitest";
import { userRowPermissions } from "./row-permissions";

const base = { viewerGroupId: 1, targetGroupId: 1, isSelf: false } as const;

describe("userRowPermissions", () => {
  it("lets an OWNER manage and reset others, never themselves", () => {
    expect(userRowPermissions({ ...base, viewerRole: "OWNER", targetRole: "ADMIN" })).toEqual({
      canManage: true,
      canReset: true,
    });
    expect(userRowPermissions({ ...base, viewerRole: "OWNER", targetRole: "OWNER", isSelf: true })).toEqual({
      canManage: false,
      canReset: false,
    });
  });

  it("lets an ADMIN reset only a USER in the same group", () => {
    expect(userRowPermissions({ ...base, viewerRole: "ADMIN", targetRole: "USER" })).toEqual({
      canManage: false,
      canReset: true,
    });
    expect(userRowPermissions({ ...base, viewerRole: "ADMIN", targetRole: "ADMIN" }).canReset).toBe(false);
    expect(userRowPermissions({ ...base, viewerRole: "ADMIN", targetRole: "USER", targetGroupId: 2 }).canReset).toBe(
      false,
    );
  });

  it("gives a USER nothing", () => {
    expect(userRowPermissions({ ...base, viewerRole: "USER", targetRole: "USER" })).toEqual({
      canManage: false,
      canReset: false,
    });
  });
});
