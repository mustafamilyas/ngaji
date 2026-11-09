import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, type PageFixture } from "@/lib/test/fixtures";
import { loadGroupTags } from "./group-tags";

let fx: PageFixture;

const make = (key: string, value: string | null, color = "blue", groupId = fx.leaf.id) =>
  db.tag.create({ data: { groupId, key, value, color, createdById: fx.actorId } });

describe("loadGroupTags (task 5.7)", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("group-tags");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("groups the owner's tags by key, simple tags and values together, ordered by key then value", async () => {
    await make("prioritas", "tinggi", "red");
    await make("prioritas", "rendah", "green");
    await make("fokus", null);

    const groups = await loadGroupTags(fx.leaf.id, { withCounts: false });

    expect(groups.map((g) => g.key)).toEqual(["fokus", "prioritas"]);
    expect(groups[1].tags.map((t) => t.value)).toEqual(["rendah", "tinggi"]);
    expect(groups[0].tags[0].value).toBeNull();
    expect(groups[1].tags[0]).not.toHaveProperty("members");
  });

  it("leaves out deleted tags and tags owned by other groups", async () => {
    await make("sudah-dihapus", null, "blue").then((t) => db.tag.update({ where: { id: t.id }, data: { deletedAt: new Date() } }));
    await make("milik-branch", null, "blue", fx.branch.id);

    const keys = (await loadGroupTags(fx.leaf.id, { withCounts: false })).map((g) => g.key);
    expect(keys).not.toContain("sudah-dihapus");
    expect(keys).not.toContain("milik-branch");
  });

  it("counts members and activities per tag when asked, ignoring deleted members and activities", async () => {
    const tag = await make("dihitung", null);
    const live = fx.memberId;
    const gone = await db.member.create({
      data: {
        groupId: fx.leaf.id, name: "Dihapus", birthPlace: "x", birthDate: "2000-01-01", sex: "L", address: "-",
        phone: "081200000003", maritalStatus: "BELUM_MENIKAH", workStatus: "BEKERJA", joinedAt: "2024-01-01",
        createdById: fx.actorId, deletedAt: new Date(),
      },
    });
    await db.memberTag.create({ data: { memberId: live, tagId: tag.id, createdById: fx.actorId } });
    await db.memberTag.create({ data: { memberId: gone.id, tagId: tag.id, createdById: fx.actorId } });
    await db.activityTag.create({ data: { activityId: fx.activityId, tagId: tag.id, createdById: fx.actorId } });

    const groups = await loadGroupTags(fx.leaf.id, { withCounts: true });
    const counted = groups.find((g) => g.key === "dihitung")!.tags[0];
    expect(counted).toMatchObject({ members: 1, activities: 1 });
  });
});
