import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { provisionOrganization } from "./provision";

let counter = 0;
function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

function validInput(overrides: Record<string, unknown> = {}) {
  const suffix = uniqueSuffix();
  return {
    organizationName: `Provision Org ${suffix}`,
    rootGroupName: `Pusat ${suffix}`,
    levelNames: ["pusat", "daerah", "desa", "kelompok"],
    timezone: "Asia/Jakarta",
    ownerUsername: `owner_${suffix}`,
    ownerName: "Owner Baru",
    ownerPassword: "kata-sandi-aman",
    ...overrides,
  };
}

function provision(input: unknown) {
  return db.$transaction((tx) => provisionOrganization(tx, input));
}

describe("provisionOrganization", () => {
  it("creates the organization, its levels in order, a root group and an OWNER", async () => {
    const input = validInput();
    const result = await provision(input);

    const organization = await db.organization.findUniqueOrThrow({
      where: { id: result.organizationId },
      include: { levels: { orderBy: { depth: "asc" } } },
    });
    expect(organization.name).toBe(input.organizationName);
    expect(organization.levels.map((l) => [l.depth, l.name])).toEqual([
      [0, "pusat"],
      [1, "daerah"],
      [2, "desa"],
      [3, "kelompok"],
    ]);

    const root = await db.group.findUniqueOrThrow({ where: { id: result.rootGroupId } });
    expect(root).toMatchObject({
      organizationId: organization.id,
      parentId: null,
      depth: 0,
      name: input.rootGroupName,
      path: `${root.id}/`,
    });

    const owner = await db.user.findUniqueOrThrow({
      where: { id: result.ownerId },
      include: { role: true },
    });
    expect(owner).toMatchObject({
      username: input.ownerUsername,
      name: input.ownerName,
      isActive: true,
      mustChangePassword: true,
    });
    expect(owner.role).toMatchObject({ groupId: root.id, role: "OWNER" });
    expect(await bcrypt.compare(input.ownerPassword, owner.passwordHash)).toBe(true);
  });

  it("defaults the timezone to Asia/Jakarta when none is given", async () => {
    const input: Record<string, unknown> = validInput();
    delete input.timezone;
    const result = await provision(input);
    const organization = await db.organization.findUniqueOrThrow({ where: { id: result.organizationId } });
    expect(organization.timezone).toBe("Asia/Jakarta");
  });

  it("stores the chosen timezone", async () => {
    const result = await provision(validInput({ timezone: "Asia/Jayapura" }));
    const organization = await db.organization.findUniqueOrThrow({ where: { id: result.organizationId } });
    expect(organization.timezone).toBe("Asia/Jayapura");
  });

  it("normalises the owner username to lowercase", async () => {
    const input = validInput();
    const result = await provision({ ...input, ownerUsername: input.ownerUsername.toUpperCase() });
    const owner = await db.user.findUniqueOrThrow({ where: { id: result.ownerId } });
    expect(owner.username).toBe(input.ownerUsername);
  });

  it("adds a second organization without changing the first", async () => {
    const first = await provision(validInput());
    const snapshot = async () => ({
      organization: await db.organization.findUniqueOrThrow({ where: { id: first.organizationId } }),
      levels: await db.level.findMany({ where: { organizationId: first.organizationId }, orderBy: { depth: "asc" } }),
      groups: await db.group.findMany({ where: { organizationId: first.organizationId } }),
      owner: await db.user.findUniqueOrThrow({ where: { id: first.ownerId } }),
    });
    const before = await snapshot();

    const second = await provision(validInput({ levelNames: ["pusat", "cabang"] }));

    expect(second.organizationId).not.toBe(first.organizationId);
    expect(await snapshot()).toEqual(before);
    const secondLevels = await db.level.findMany({ where: { organizationId: second.organizationId } });
    expect(secondLevels).toHaveLength(2);
  });

  it("writes organization.create and user.create audits for the root group with no actor and no password hash", async () => {
    const result = await provision(validInput());

    const rows = await db.auditLog.findMany({
      where: { groupId: result.rootGroupId },
      orderBy: { id: "asc" },
    });
    expect(rows.map((r) => r.action).sort()).toEqual(["organization.create", "user.create"]);
    for (const row of rows) {
      expect(row.actorId).toBeNull();
      expect(JSON.stringify(row)).not.toContain("passwordHash");
      expect(JSON.stringify(row)).not.toContain("$2");
    }
    const orgRow = rows.find((r) => r.action === "organization.create")!;
    expect(orgRow).toMatchObject({ entity: "Organization", entityId: result.organizationId });
    const userRow = rows.find((r) => r.action === "user.create")!;
    expect(userRow).toMatchObject({ entity: "User", entityId: result.ownerId });
  });

  describe("invalid input creates nothing", () => {
    async function counts() {
      return {
        organizations: await db.organization.count(),
        levels: await db.level.count(),
        groups: await db.group.count(),
        users: await db.user.count(),
        audits: await db.auditLog.count(),
      };
    }

    async function expectRejected(input: unknown, message: RegExp) {
      const before = await counts();
      const error = await provision(input).then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toMatch(message);
      expect(await counts()).toEqual(before);
    }

    it("rejects a username already used in another organization", async () => {
      const first = validInput();
      await provision(first);
      await expectRejected(validInput({ ownerUsername: first.ownerUsername }), /sudah dipakai/);
    });

    it("rejects a username that differs only by case from an existing one", async () => {
      const first = validInput();
      await provision(first);
      await expectRejected(validInput({ ownerUsername: first.ownerUsername.toUpperCase() }), /sudah dipakai/);
    });

    it("rejects an unsupported timezone", async () => {
      await expectRejected(validInput({ timezone: "Europe/London" }), /zona waktu/i);
    });

    it("rejects a password shorter than the minimum", async () => {
      await expectRejected(validInput({ ownerPassword: "pendek" }), /minimal 8/);
    });

    it("rejects an empty level list", async () => {
      await expectRejected(validInput({ levelNames: [] }), /jenjang/i);
    });

    it("rejects a missing organization name", async () => {
      await expectRejected(validInput({ organizationName: "  " }), /./);
    });

    it("rejects an invalid username", async () => {
      await expectRejected(validInput({ ownerUsername: "a b" }), /Username/);
    });
  });
});
