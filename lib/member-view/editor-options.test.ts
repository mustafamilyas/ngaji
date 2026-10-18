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
});
