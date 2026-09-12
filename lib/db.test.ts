import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, resolveDatabaseUrl } from "./db";

describe("resolveDatabaseUrl", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  it("resolves a relative file URL against the prisma/ directory, not process.cwd() alone", () => {
    process.env.DATABASE_URL = "file:./dev.db";
    expect(resolveDatabaseUrl()).toBe(`file:${path.join(process.cwd(), "prisma", "dev.db")}`);
  });

  it("leaves an absolute file URL untouched", () => {
    const absolute = `file:${path.join(process.cwd(), "prisma", "test.db")}`;
    process.env.DATABASE_URL = absolute;
    expect(resolveDatabaseUrl()).toBe(absolute);
  });

  it("leaves a non-file URL untouched", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    expect(resolveDatabaseUrl()).toBe("postgresql://user:pass@localhost:5432/db");
  });

  it("falls back to file:./dev.db, resolved, when DATABASE_URL is unset", () => {
    delete process.env.DATABASE_URL;
    expect(resolveDatabaseUrl()).toBe(`file:${path.join(process.cwd(), "prisma", "dev.db")}`);
  });
});

describe("db soft-delete extension", () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({
      data: { name: "Test Org" },
    });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("excludes a soft-deleted Group from findMany with no where clause", async () => {
    const kept = await db.group.create({
      data: { organizationId, depth: 0, name: "Kept", path: "0/" },
    });
    const deleted = await db.group.create({
      data: {
        organizationId,
        depth: 0,
        name: "Deleted",
        path: "0/",
        deletedAt: new Date(),
      },
    });

    const rows = await db.group.findMany();
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(kept.id);
    expect(ids).not.toContain(deleted.id);
  });

  it("returns null from findUnique for a soft-deleted Group", async () => {
    const group = await db.group.create({
      data: {
        organizationId,
        depth: 0,
        name: "Solo",
        path: "0/",
        deletedAt: new Date(),
      },
    });

    const found = await db.group.findUnique({ where: { id: group.id } });
    expect(found).toBeNull();
  });

  it("excludes a soft-deleted Member from findMany even with an explicit where clause", async () => {
    const group = await db.group.create({
      data: { organizationId, depth: 0, name: "Member Group", path: "0/" },
    });
    const owner = await db.user.create({
      data: { username: `owner-${group.id}`, passwordHash: "x", name: "Owner" },
    });
    const kept = await db.member.create({
      data: {
        groupId: group.id,
        name: "Kept Member",
        birthPlace: "Jakarta",
        birthDate: "2000-01-01",
        sex: "L",
        address: "-",
        phone: "0800000000",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        joinedAt: "2024-01-01",
        createdById: owner.id,
      },
    });
    const deleted = await db.member.create({
      data: {
        groupId: group.id,
        name: "Deleted Member",
        birthPlace: "Jakarta",
        birthDate: "2000-01-01",
        sex: "L",
        address: "-",
        phone: "0800000001",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        joinedAt: "2024-01-01",
        createdById: owner.id,
        deletedAt: new Date(),
      },
    });

    const rows = await db.member.findMany({ where: { groupId: group.id } });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(kept.id);
    expect(ids).not.toContain(deleted.id);
  });
});
