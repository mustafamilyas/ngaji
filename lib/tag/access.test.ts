import { describe, expect, it } from "vitest";
import {
  canTagActivity,
  canTagMember,
  canUseTag,
  canViewTag,
  visibleTagWhere,
} from "./access";

// Tree: pusat "1/" -> daerah "1/2/" -> desa D "1/2/3/" -> kelompok K1 "1/2/3/4/", K2 "1/2/3/5/"
//                                      -> desa E "1/2/6/" -> kelompok "1/2/6/7/"
// Other organization: "9/" -> "9/10/"
const PUSAT = "1/";
const DAERAH = "1/2/";
const DESA_D = "1/2/3/";
const K1 = "1/2/3/4/";
const K2 = "1/2/3/5/";
const DESA_E = "1/2/6/";
const K_E = "1/2/6/7/";
const OTHER_ORG = "9/10/";

const user = (groupPath: string) => ({ groupPath });

describe("canViewTag", () => {
  it("sees a tag owned by its own group", () => {
    expect(canViewTag(user(K1), K1)).toBe(true);
  });

  it("sees a tag owned by an ancestor", () => {
    expect(canViewTag(user(K1), DESA_D)).toBe(true);
    expect(canViewTag(user(K1), PUSAT)).toBe(true);
  });

  it("sees a tag owned by a descendant (in scope)", () => {
    expect(canViewTag(user(DESA_D), K1)).toBe(true);
  });

  it("does not see a sibling's tag", () => {
    expect(canViewTag(user(K2), K1)).toBe(false);
  });

  it("does not see a tag in another branch", () => {
    expect(canViewTag(user(K1), K_E)).toBe(false);
    expect(canViewTag(user(K1), DESA_E)).toBe(false);
  });

  it("does not see a tag from another organization", () => {
    expect(canViewTag(user(K1), OTHER_ORG)).toBe(false);
  });

  it("does not confuse numeric prefixes (1/5/ vs 1/50/)", () => {
    expect(canViewTag(user("1/5/"), "1/50/")).toBe(false);
  });
});

describe("canUseTag", () => {
  it("uses a tag owned by its own group", () => {
    expect(canUseTag(user(K1), K1)).toBe(true);
  });

  it("uses a tag owned by an ancestor", () => {
    expect(canUseTag(user(K1), DESA_D)).toBe(true);
    expect(canUseTag(user(K1), PUSAT)).toBe(true);
  });

  it("cannot use a tag owned by a descendant (visible but not usable)", () => {
    expect(canUseTag(user(DESA_D), K1)).toBe(false);
  });

  it("cannot use a sibling's or another organization's tag", () => {
    expect(canUseTag(user(K2), K1)).toBe(false);
    expect(canUseTag(user(K1), OTHER_ORG)).toBe(false);
  });
});

describe("canTagMember", () => {
  it("allows a member of the user's own group with the group's tag", () => {
    expect(canTagMember(user(K1), K1, K1)).toBe(true);
  });

  it("allows a member in scope inside the subtree of an ancestor's tag", () => {
    expect(canTagMember(user(K1), DESA_D, K1)).toBe(true);
    expect(canTagMember(user(DESA_D), DESA_D, K2)).toBe(true);
  });

  it("rejects a member outside the tag group's subtree", () => {
    // K1 tag, member of sibling K2: user in desa D could see both but cannot use K1's tag anyway.
    expect(canTagMember(user(K1), K1, K2)).toBe(false);
    expect(canTagMember(user(DAERAH), DAERAH, DAERAH)).toBe(true);
    expect(canTagMember(user(DAERAH), DAERAH, OTHER_ORG)).toBe(false);
  });

  it("rejects a member outside the user's scope even when inside the tag subtree", () => {
    // Pusat tag covers K_E, but a user in K1 cannot reach members of K_E.
    expect(canTagMember(user(K1), PUSAT, K_E)).toBe(false);
  });

  it("rejects an unusable tag even for an in-scope member", () => {
    expect(canTagMember(user(DESA_D), K1, K1)).toBe(false);
  });
});

describe("canTagActivity", () => {
  it("allows an activity owned by the tag's own group", () => {
    expect(canTagActivity(user(K1), K1, K1)).toBe(true);
  });

  it("allows an inherited (ancestor-owned) activity with the user's group tag", () => {
    expect(canTagActivity(user(K1), K1, PUSAT)).toBe(true);
    expect(canTagActivity(user(K1), DESA_D, PUSAT)).toBe(true);
  });

  it("allows a descendant-owned activity in the tag group's subtree", () => {
    expect(canTagActivity(user(DESA_D), DESA_D, K1)).toBe(true);
  });

  it("rejects an activity in an unrelated branch", () => {
    expect(canTagActivity(user(K1), K1, K2)).toBe(false);
    expect(canTagActivity(user(K1), K1, K_E)).toBe(false);
  });

  it("rejects an activity the user cannot see", () => {
    expect(canTagActivity(user(DESA_D), DESA_D, K_E)).toBe(false);
    expect(canTagActivity(user(K1), K1, OTHER_ORG)).toBe(false);
  });

  it("rejects an unusable tag even on a visible activity", () => {
    expect(canTagActivity(user(DESA_D), K1, K1)).toBe(false);
  });
});

describe("visibleTagWhere", () => {
  it("filters deleted tags and matches ancestor-or-self paths plus the scope", () => {
    expect(visibleTagWhere(user(K1))).toEqual({
      deletedAt: null,
      group: {
        OR: [
          { path: { in: [PUSAT, DAERAH, DESA_D, K1] } },
          { path: { startsWith: K1 } },
        ],
      },
    });
  });

  it("for a root user lists only the root as ancestor", () => {
    const where = visibleTagWhere(user(PUSAT));
    expect(where.group.OR[0]).toEqual({ path: { in: [PUSAT] } });
    expect(where.group.OR[1]).toEqual({ path: { startsWith: PUSAT } });
  });
});
