import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { loadEditorOptions } from "./editor-options";

describe("loadEditorOptions", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("offers only in-scope, live groups and the levels from the viewer's own level down", async () => {
    const fx = await buildPageFixture("view-editor-options");
    const gone = await db.group.create({
      data: { organizationId: (await db.group.findUniqueOrThrow({ where: { id: fx.leaf.id } })).organizationId, parentId: fx.branch.id, depth: 2, name: "Terhapus", path: `${fx.branch.path}9999/`, deletedAt: new Date() },
    });

    const branch = await loadEditorOptions(sessionFor(fx.actorId, "ADMIN", fx.branch));
    const labels = branch.groups.map((g) => g.label);
    expect(labels).toContain("Root › Branch");
    expect(labels).toContain("Branch › Leaf");
    expect(labels).not.toContain("Root");
    expect(labels.join()).not.toContain(gone.name);
    expect(branch.levels.map((l) => l.depth)).toEqual([1, 2]);

    const leaf = await loadEditorOptions(sessionFor(fx.actorId, "USER", fx.leaf));
    expect(leaf.groups.map((g) => g.id)).toEqual([fx.leaf.id]);
    expect(leaf.levels.map((l) => l.name)).toEqual(["Leaf"]);
  });

  it("offers only the tags the viewer can see, labelled key or key:value", async () => {
    const fx = await buildPageFixture("view-editor-tags");
    const newTag = (groupId: number, key: string, value: string | null = null, deletedAt: Date | null = null) =>
      db.tag.create({ data: { groupId, key, value, color: "blue", createdById: fx.actorId, deletedAt } });
    const inherited = await newTag(fx.branch.id, "binaan");
    const own = await newTag(fx.leaf.id, "prioritas", "tinggi");
    const below = await newTag(fx.leaf.id, "fokus");
    const sibling = await newTag(fx.otherLeaf.id, "saudara");
    const gone = await newTag(fx.leaf.id, "terhapus", null, new Date());

    const leaf = await loadEditorOptions(sessionFor(fx.actorId, "ADMIN", fx.leaf));
    const ids = leaf.tags.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([inherited.id, own.id, below.id]));
    expect(ids).not.toContain(sibling.id);
    expect(ids).not.toContain(gone.id);
    expect(leaf.tags.find((t) => t.id === own.id)?.label).toBe("prioritas:tinggi");
    expect(leaf.tags.find((t) => t.id === below.id)?.label).toBe("fokus");

    const branch = await loadEditorOptions(sessionFor(fx.actorId, "ADMIN", fx.branch));
    expect(branch.tags.map((t) => t.id)).toEqual(expect.arrayContaining([inherited.id, own.id, below.id, sibling.id]));
  });
});
