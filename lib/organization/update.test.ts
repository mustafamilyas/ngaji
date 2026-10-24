import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { buildOrgFixture, sessionFor, type OrgFixture } from "@/lib/test/fixtures";
import { updateOrganization } from "./update";

describe("updateOrganization", () => {
  let orgA: OrgFixture;
  let orgB: OrgFixture;

  beforeAll(async () => {
    orgA = await buildOrgFixture("org-update-a");
    orgB = await buildOrgFixture("org-update-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const loadOrg = (id: number) => db.organization.findUniqueOrThrow({ where: { id } });
  const updateAudits = (organizationId: number) =>
    db.auditLog.findMany({ where: { action: "organization.update", entityId: organizationId }, orderBy: { id: "asc" } });

  it("lets the root OWNER change the name and timezone and audits only what changed with before/after", async () => {
    const before = await loadOrg(orgA.organizationId);

    const updated = await updateOrganization(orgA.owner, { name: "  Majelis An-Nur  ", timezone: "Asia/Makassar" });

    expect(updated).toMatchObject({ id: orgA.organizationId, name: "Majelis An-Nur", timezone: "Asia/Makassar" });
    const [entry] = await updateAudits(orgA.organizationId);
    expect(entry).toMatchObject({
      actorId: Number(orgA.owner.id),
      entity: "Organization",
      groupId: orgA.root.id,
      before: { name: before.name, timezone: "Asia/Jakarta" },
      after: { name: "Majelis An-Nur", timezone: "Asia/Makassar" },
    });
  });

  it("records only the timezone when only the timezone changed", async () => {
    const current = await loadOrg(orgA.organizationId);
    const next = current.timezone === "Asia/Jayapura" ? "Asia/Jakarta" : "Asia/Jayapura";

    await updateOrganization(orgA.owner, { name: current.name, timezone: next });

    const entries = await updateAudits(orgA.organizationId);
    expect(entries.at(-1)).toMatchObject({ before: { timezone: current.timezone }, after: { timezone: next } });
    expect(entries.at(-1)?.before).not.toHaveProperty("name");
  });

  it("writes nothing and no audit row when nothing changed", async () => {
    const current = await loadOrg(orgA.organizationId);
    const auditsBefore = (await updateAudits(orgA.organizationId)).length;

    await updateOrganization(orgA.owner, { name: current.name, timezone: current.timezone });

    expect((await updateAudits(orgA.organizationId)).length).toBe(auditsBefore);
    expect((await loadOrg(orgA.organizationId)).updatedAt).toEqual(current.updatedAt);
  });

  it("updates only the caller's own organization", async () => {
    const otherBefore = await loadOrg(orgB.organizationId);

    await updateOrganization(orgA.owner, { name: "Hanya Org A", timezone: "Asia/Jakarta" });

    expect(await loadOrg(orgB.organizationId)).toEqual(otherBefore);
    expect(await updateAudits(orgB.organizationId)).toHaveLength(0);
  });

  it.each(["ADMIN", "USER"] as const)("denies a %s at the root without writing", async (role) => {
    const before = await loadOrg(orgA.organizationId);
    const auditsBefore = (await updateAudits(orgA.organizationId)).length;
    const caller = sessionFor(Number(orgA.owner.id), role, { ...orgA.root, organizationId: orgA.organizationId });

    await expect(updateOrganization(caller, { name: "Diubah", timezone: "Asia/Jayapura" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    expect(await loadOrg(orgA.organizationId)).toEqual(before);
    expect(await updateAudits(orgA.organizationId)).toHaveLength(auditsBefore);
  });

  it("denies an OWNER below the root without writing", async () => {
    const before = await loadOrg(orgA.organizationId);
    const auditsBefore = (await updateAudits(orgA.organizationId)).length;
    const caller = sessionFor(Number(orgA.owner.id), "OWNER", { ...orgA.branch, organizationId: orgA.organizationId });

    await expect(updateOrganization(caller, { name: "Diubah", timezone: "Asia/Jayapura" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    expect(await loadOrg(orgA.organizationId)).toEqual(before);
    expect(await updateAudits(orgA.organizationId)).toHaveLength(auditsBefore);
  });

  it("rejects a blank name and leaves the name unchanged", async () => {
    const before = await loadOrg(orgA.organizationId);

    await expect(updateOrganization(orgA.owner, { name: "   ", timezone: "Asia/Jakarta" })).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect((await loadOrg(orgA.organizationId)).name).toBe(before.name);
  });

  it("rejects an unsupported timezone", async () => {
    const before = await loadOrg(orgA.organizationId);

    await expect(
      updateOrganization(orgA.owner, { name: before.name, timezone: "Europe/London" }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect((await loadOrg(orgA.organizationId)).timezone).toBe(before.timezone);
  });
});
