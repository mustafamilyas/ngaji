import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { listTags } from "./list";

let fx: PageFixture;
let seq = 0;

const make = (groupId: number, key: string, value: string | null = null, deletedAt: Date | null = null) =>
  db.tag.create({ data: { groupId, key, value, color: "blue", createdById: fx.actorId, deletedAt } });

describe("lib/tag/list listTags", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("tag-list");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("lists visible tags by owner: own group first, ancestors nearest-first, then descendants", async () => {
    const f = await buildPageFixture(`tag-list-order-${++seq}`);
    const rootTag = await db.tag.create({ data: { groupId: f.root.id, key: "dari-pusat", color: "blue", createdById: f.actorId } });
    const branchTag = await db.tag.create({ data: { groupId: f.branch.id, key: "dari-daerah", color: "blue", createdById: f.actorId } });
    const leafTag = await db.tag.create({ data: { groupId: f.leaf.id, key: "milik-sendiri", color: "blue", createdById: f.actorId } });
    const siblingTag = await db.tag.create({ data: { groupId: f.otherLeaf.id, key: "saudara", color: "blue", createdById: f.actorId } });

    const { visible } = await listTags(sessionFor(f.actorId, "ADMIN", f.leaf));
    expect(visible.map((g) => g.group.id)).toEqual([f.leaf.id, f.branch.id, f.root.id]);
    expect(visible.map((g) => g.group.isOwn)).toEqual([true, false, false]);
    expect(visible.flatMap((g) => g.tags.map((t) => t.id))).toEqual([leafTag.id, branchTag.id, rootTag.id]);
    expect(visible.flatMap((g) => g.tags.map((t) => t.id))).not.toContain(siblingTag.id);

    // An ancestor sees its own tags first and descendants' tags last, by depth then name.
    const above = await listTags(sessionFor(f.actorId, "ADMIN", f.branch));
    expect(above.visible.map((g) => g.group.id)).toEqual([f.branch.id, f.root.id, f.leaf.id, f.otherLeaf.id]);
    expect(above.visible.map((g) => g.group.name)).toEqual(["Branch", "Root", "Leaf", "Other Leaf"]);
  });

  it("offers for use only the tags of the user's own group and its ancestors", async () => {
    const f = await buildPageFixture(`tag-list-usable-${++seq}`);
    await db.tag.createMany({
      data: [f.root.id, f.branch.id, f.leaf.id, f.otherLeaf.id].map((groupId) => ({
        groupId,
        key: "fokus",
        color: "blue",
        createdById: f.actorId,
      })),
    });

    const atBranch = await listTags(sessionFor(f.actorId, "ADMIN", f.branch));
    expect(atBranch.usable.map((g) => g.group.id)).toEqual([f.branch.id, f.root.id]);
    expect(atBranch.visible.map((g) => g.group.id)).toHaveLength(4);

    const atLeaf = await listTags(sessionFor(f.actorId, "USER", f.leaf));
    expect(atLeaf.usable.map((g) => g.group.id)).toEqual([f.leaf.id, f.branch.id, f.root.id]);
  });

  it("sorts tags by key then value with the simple tag first, and omits empty groups and deleted tags", async () => {
    const f = await buildPageFixture(`tag-list-sort-${++seq}`);
    const mk = (key: string, value: string | null = null, deletedAt: Date | null = null) =>
      db.tag.create({ data: { groupId: f.leaf.id, key, value, color: "red", createdById: f.actorId, deletedAt } });
    const rendah = await mk("prioritas", "rendah");
    const tinggi = await mk("prioritas", "tinggi");
    const binaan = await mk("binaan");
    await mk("gone", null, new Date());

    const { visible, usable } = await listTags(sessionFor(f.actorId, "ADMIN", f.leaf));
    expect(visible).toHaveLength(1);
    expect(usable).toHaveLength(1);
    expect(visible[0].tags.map((t) => t.id)).toEqual([binaan.id, rendah.id, tinggi.id]);
    expect(visible[0].tags[0]).toEqual({ id: binaan.id, groupId: f.leaf.id, key: "binaan", value: null, color: "red" });
  });

  it("never lists another organization's tags", async () => {
    const foreign = await make(fx.root.id, "milik-org-lain");
    const other = await buildPageFixture(`tag-list-other-${++seq}`);
    const { visible } = await listTags(sessionFor(other.actorId, "OWNER", other.root));
    expect(visible.flatMap((g) => g.tags.map((t) => t.id))).not.toContain(foreign.id);
  });
});
