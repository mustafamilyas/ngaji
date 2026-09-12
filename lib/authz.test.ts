import { describe, expect, it } from "vitest";
import {
  authorize,
  canEditActivity,
  canRecordAttendance,
  canViewActivity,
  visibleGroupsWhere,
} from "./authz";
import { ForbiddenError, NotFoundError } from "./errors";
import type { SessionUser } from "./auth/session-user";
import type { Role } from "./validation/enums";

// Tree used throughout: root "1/" -> daerah "1/2/" -> desa "1/2/3/" -> kelompok "1/2/3/4/"
const ROOT = "1/";
const DAERAH = "1/2/";
const DESA = "1/2/3/";
const KELOMPOK = "1/2/3/4/";
const OTHER_DAERAH = "1/9/";
const OTHER_KELOMPOK = "1/9/8/7/";

function session(role: Role, groupId: number, groupPath: string): SessionUser {
  return {
    id: "1",
    username: "tester",
    name: "Tester",
    role,
    groupId,
    groupPath,
    mustChangePassword: false,
  };
}

describe("visibleGroupsWhere", () => {
  it("scopes to the session's own path with startsWith", () => {
    const where = visibleGroupsWhere(session("OWNER", 2, DAERAH));
    expect(where).toMatchObject({ path: { startsWith: DAERAH }, deletedAt: null });
  });
});

describe("authorize — view-family actions (group/member/stats/user), all roles", () => {
  const viewActions = ["group.view", "member.view", "stats.view", "user.view"] as const;
  const roles: Role[] = ["OWNER", "ADMIN", "USER"];

  for (const action of viewActions) {
    for (const role of roles) {
      it(`${role} can ${action} a target within scope`, () => {
        const s = session(role, 2, DAERAH);
        expect(() => authorize(s, action, { groupPath: DESA })).not.toThrow();
      });

      it(`${role} gets NotFoundError for ${action} on a sibling-branch target`, () => {
        const s = session(role, 2, DAERAH);
        expect(() => authorize(s, action, { groupPath: OTHER_DAERAH })).toThrow(NotFoundError);
      });

      it(`${role} gets NotFoundError for ${action} on an ancestor target (above scope)`, () => {
        const s = session(role, 3, DESA);
        expect(() => authorize(s, action, { groupPath: DAERAH })).toThrow(NotFoundError);
      });
    }
  }
});

describe("authorize — member create/update/delete, all roles allowed within scope", () => {
  const actions = ["member.create", "member.update", "member.delete"] as const;
  const roles: Role[] = ["OWNER", "ADMIN", "USER"];

  for (const action of actions) {
    for (const role of roles) {
      it(`${role} can ${action} within scope`, () => {
        const s = session(role, 2, DAERAH);
        expect(() => authorize(s, action, { groupPath: DESA })).not.toThrow();
      });
    }
    it(`out-of-scope ${action} is NotFoundError regardless of role`, () => {
      const s = session("OWNER", 2, DAERAH);
      expect(() => authorize(s, action, { groupPath: OTHER_DAERAH })).toThrow(NotFoundError);
    });
  }
});

describe("authorize — group create/update/delete, role >= ADMIN required", () => {
  const actions = ["group.create", "group.update", "group.delete"] as const;

  for (const action of actions) {
    it(`OWNER can ${action} within scope`, () => {
      const s = session("OWNER", 2, DAERAH);
      expect(() => authorize(s, action, { groupPath: DESA })).not.toThrow();
    });

    it(`ADMIN can ${action} within scope`, () => {
      const s = session("ADMIN", 2, DAERAH);
      expect(() => authorize(s, action, { groupPath: DESA })).not.toThrow();
    });

    it(`USER gets ForbiddenError for ${action} within scope`, () => {
      const s = session("USER", 2, DAERAH);
      expect(() => authorize(s, action, { groupPath: DESA })).toThrow(ForbiddenError);
    });

    it(`out-of-scope ${action} is NotFoundError even for OWNER (checked before role)`, () => {
      const s = session("OWNER", 2, DAERAH);
      expect(() => authorize(s, action, { groupPath: OTHER_DAERAH })).toThrow(NotFoundError);
    });
  }
});

describe("canViewActivity / authorize activity.view", () => {
  it("is visible for the activity's own group", () => {
    expect(canViewActivity(session("USER", 3, DESA), DESA)).toBe(true);
  });

  it("is visible when the activity belongs to a descendant group (own scope)", () => {
    expect(canViewActivity(session("USER", 3, DESA), KELOMPOK)).toBe(true);
  });

  it("is visible when the activity belongs to an ancestor group (inherited)", () => {
    expect(canViewActivity(session("USER", 4, KELOMPOK), DAERAH)).toBe(true);
  });

  it("is not visible for a sibling branch", () => {
    expect(canViewActivity(session("USER", 3, DESA), OTHER_DAERAH)).toBe(false);
  });

  it("authorize throws NotFoundError when not visible", () => {
    const s = session("OWNER", 3, DESA);
    expect(() => authorize(s, "activity.view", { groupPath: OTHER_DAERAH })).toThrow(NotFoundError);
  });
});

describe("authorize activity.create — role >= ADMIN and groupId === session.groupId exactly", () => {
  it("ADMIN can create for their own group", () => {
    const s = session("ADMIN", 3, DESA);
    expect(() => authorize(s, "activity.create", { groupId: 3 })).not.toThrow();
  });

  it("USER cannot create even for their own group", () => {
    const s = session("USER", 3, DESA);
    expect(() => authorize(s, "activity.create", { groupId: 3 })).toThrow(ForbiddenError);
  });

  it("root OWNER cannot create an activity for a descendant kelompok group", () => {
    const s = session("OWNER", 1, ROOT);
    expect(() => authorize(s, "activity.create", { groupId: 4 })).toThrow(ForbiddenError);
  });
});

describe("canEditActivity / authorize activity.update — edit is strictly the owning group", () => {
  it("ADMIN at the owning group can edit", () => {
    expect(canEditActivity(session("ADMIN", 4, KELOMPOK), 4)).toBe(true);
  });

  it("USER at the owning group cannot edit", () => {
    expect(canEditActivity(session("USER", 4, KELOMPOK), 4)).toBe(false);
  });

  it("root OWNER cannot edit a kelompok-owned activity", () => {
    expect(canEditActivity(session("OWNER", 1, ROOT), 4)).toBe(false);
  });

  it("a daerah ADMIN cannot edit a kelompok-owned activity even though it's in scope", () => {
    expect(canEditActivity(session("ADMIN", 2, DAERAH), 4)).toBe(false);
  });

  it("authorize throws ForbiddenError for root OWNER editing a kelompok activity", () => {
    const s = session("OWNER", 1, ROOT);
    expect(() => authorize(s, "activity.update", { groupId: 4 })).toThrow(ForbiddenError);
  });

  it("occurrence.override follows the same rule as activity.update", () => {
    const s = session("OWNER", 1, ROOT);
    expect(() => authorize(s, "occurrence.override", { groupId: 4 })).toThrow(ForbiddenError);
  });
});

describe("canRecordAttendance / authorize attendance.record", () => {
  it("a user at the activity's owning group can record for a leaf below it", () => {
    const s = session("USER", 3, DESA); // owns activity at DESA
    const ok = canRecordAttendance(s, DESA, { path: KELOMPOK, isLeaf: true });
    expect(ok).toBe(true);
  });

  it("kelompok USER can record attendance for a daerah-owned (inherited) activity", () => {
    const s = session("USER", 4, KELOMPOK);
    const ok = canRecordAttendance(s, DAERAH, { path: KELOMPOK, isLeaf: true });
    expect(ok).toBe(true);
  });

  it("a daerah ADMIN cannot record attendance for a kelompok-owned activity (above the owning group)", () => {
    const s = session("ADMIN", 2, DAERAH);
    const ok = canRecordAttendance(s, KELOMPOK, { path: KELOMPOK, isLeaf: true });
    expect(ok).toBe(false);
  });

  it("rejects a non-leaf target group even if otherwise in scope", () => {
    const s = session("USER", 2, DAERAH);
    const ok = canRecordAttendance(s, DAERAH, { path: DESA, isLeaf: false });
    expect(ok).toBe(false);
  });

  it("rejects a leaf group the activity doesn't apply to (different branch)", () => {
    const s = session("OWNER", 1, ROOT);
    const ok = canRecordAttendance(s, OTHER_DAERAH, { path: KELOMPOK, isLeaf: true });
    expect(ok).toBe(false);
  });

  it("rejects a leaf group outside the user's own scope", () => {
    const s = session("USER", 3, DESA);
    const ok = canRecordAttendance(s, ROOT, { path: OTHER_KELOMPOK, isLeaf: true });
    expect(ok).toBe(false);
  });

  it("authorize throws ForbiddenError when the structural conditions fail", () => {
    const s = session("ADMIN", 2, DAERAH);
    expect(() =>
      authorize(s, "attendance.record", {
        activityGroupPath: KELOMPOK,
        leafGroupPath: KELOMPOK,
        isLeaf: true,
      }),
    ).toThrow(ForbiddenError);
  });
});

describe("authorize user.create", () => {
  it("ADMIN can create a USER in scope", () => {
    const s = session("ADMIN", 2, DAERAH);
    expect(() => authorize(s, "user.create", { groupPath: DESA, newRole: "USER" })).not.toThrow();
  });

  it("ADMIN can create another ADMIN in scope", () => {
    const s = session("ADMIN", 2, DAERAH);
    expect(() => authorize(s, "user.create", { groupPath: DESA, newRole: "ADMIN" })).not.toThrow();
  });

  it("ADMIN cannot create an OWNER", () => {
    const s = session("ADMIN", 2, DAERAH);
    expect(() => authorize(s, "user.create", { groupPath: DESA, newRole: "OWNER" })).toThrow(
      ForbiddenError,
    );
  });

  it("OWNER can create an OWNER in scope", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() => authorize(s, "user.create", { groupPath: DESA, newRole: "OWNER" })).not.toThrow();
  });

  it("USER cannot create any user", () => {
    const s = session("USER", 2, DAERAH);
    expect(() => authorize(s, "user.create", { groupPath: DESA, newRole: "USER" })).toThrow(
      ForbiddenError,
    );
  });

  it("out-of-scope target group is NotFoundError", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() =>
      authorize(s, "user.create", { groupPath: OTHER_DAERAH, newRole: "USER" }),
    ).toThrow(NotFoundError);
  });
});

describe("authorize user.resetPassword", () => {
  it("OWNER can reset anyone in scope, including another OWNER", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: DESA, role: "OWNER", groupId: 3 }),
    ).not.toThrow();
  });

  it("ADMIN can reset a USER in the exact same group", () => {
    const s = session("ADMIN", 3, DESA);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: DESA, role: "USER", groupId: 3 }),
    ).not.toThrow();
  });

  it("ADMIN cannot reset a peer ADMIN", () => {
    const s = session("ADMIN", 3, DESA);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: DESA, role: "ADMIN", groupId: 3 }),
    ).toThrow(ForbiddenError);
  });

  it("ADMIN cannot reset an OWNER", () => {
    const s = session("ADMIN", 3, DESA);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: DESA, role: "OWNER", groupId: 3 }),
    ).toThrow(ForbiddenError);
  });

  it("ADMIN cannot reset a USER in a child group (must be the exact same group)", () => {
    const s = session("ADMIN", 3, DESA);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: KELOMPOK, role: "USER", groupId: 4 }),
    ).toThrow(ForbiddenError);
  });

  it("USER cannot reset anyone", () => {
    const s = session("USER", 3, DESA);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: DESA, role: "USER", groupId: 3 }),
    ).toThrow(ForbiddenError);
  });

  it("out-of-scope target is NotFoundError, checked before role rules", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() =>
      authorize(s, "user.resetPassword", { groupPath: OTHER_DAERAH, role: "USER", groupId: 8 }),
    ).toThrow(NotFoundError);
  });
});

describe("authorize user.updateRole / user.move / user.setActive", () => {
  const actions = ["user.updateRole", "user.setActive"] as const;

  for (const action of actions) {
    it(`OWNER can ${action} another user in scope`, () => {
      const s = session("OWNER", 2, DAERAH);
      expect(() =>
        authorize(s, action, { userId: 99, groupPath: DESA }),
      ).not.toThrow();
    });

    it(`ADMIN cannot ${action} (OWNER-only)`, () => {
      const s = session("ADMIN", 2, DAERAH);
      expect(() => authorize(s, action, { userId: 99, groupPath: DESA })).toThrow(
        ForbiddenError,
      );
    });

    it(`${action} on self is rejected`, () => {
      const s = session("OWNER", 2, DAERAH);
      expect(() => authorize(s, action, { userId: 1, groupPath: DESA })).toThrow(ForbiddenError);
    });

    it(`${action} on the last active root OWNER is rejected`, () => {
      const s = session("OWNER", 1, ROOT);
      expect(() =>
        authorize(s, action, { userId: 42, groupPath: ROOT, isLastActiveRootOwner: true }),
      ).toThrow(ForbiddenError);
    });
  }

  it("user.move does not apply the self-protection rule", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() => authorize(s, "user.move", { userId: 1, groupPath: DESA })).not.toThrow();
  });

  it("user.move does not apply the last-root-owner rule", () => {
    const s = session("OWNER", 1, ROOT);
    expect(() =>
      authorize(s, "user.move", { userId: 42, groupPath: ROOT, isLastActiveRootOwner: true }),
    ).not.toThrow();
  });
});

describe("authorize level.rename", () => {
  it("root OWNER can rename levels", () => {
    const s = session("OWNER", 1, ROOT);
    expect(() => authorize(s, "level.rename")).not.toThrow();
  });

  it("a non-root OWNER cannot rename levels", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() => authorize(s, "level.rename")).toThrow(ForbiddenError);
  });

  it("root ADMIN cannot rename levels", () => {
    const s = session("ADMIN", 1, ROOT);
    expect(() => authorize(s, "level.rename")).toThrow(ForbiddenError);
  });
});

describe("authorize audit.view", () => {
  it("OWNER can view audit", () => {
    const s = session("OWNER", 2, DAERAH);
    expect(() => authorize(s, "audit.view")).not.toThrow();
  });

  it("ADMIN is denied", () => {
    const s = session("ADMIN", 2, DAERAH);
    expect(() => authorize(s, "audit.view")).toThrow(ForbiddenError);
  });

  it("USER is denied", () => {
    const s = session("USER", 2, DAERAH);
    expect(() => authorize(s, "audit.view")).toThrow(ForbiddenError);
  });
});
