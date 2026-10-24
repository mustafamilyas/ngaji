import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildOrgFixture, mockAuthSession, sessionFor, type OrgFixture } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { updateOrganizationAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("updateOrganizationAction", () => {
  let orgA: OrgFixture;
  let orgB: OrgFixture;

  beforeAll(async () => {
    orgA = await buildOrgFixture("org-action-a");
    orgB = await buildOrgFixture("org-action-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const loadOrg = (id: number) => db.organization.findUniqueOrThrow({ where: { id } });
  const auditCount = (organizationId: number) =>
    db.auditLog.count({ where: { action: "organization.update", entityId: organizationId } });

  it("updates the root OWNER's organization and revalidates the dashboard layout", async () => {
    mockAuthSession(auth, { user: orgA.owner });

    const result = await updateOrganizationAction(null, form({ name: "Majelis An-Nur", timezone: "Asia/Makassar" }));

    expect(result.ok).toBe(true);
    expect(await loadOrg(orgA.organizationId)).toMatchObject({ name: "Majelis An-Nur", timezone: "Asia/Makassar" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("ignores an organization id in the form and updates only the caller's organization", async () => {
    mockAuthSession(auth, { user: orgA.owner });
    const otherBefore = await loadOrg(orgB.organizationId);

    await updateOrganizationAction(
      null,
      form({ name: "Hanya Org A", timezone: "Asia/Jakarta", organizationId: String(orgB.organizationId), id: String(orgB.organizationId) }),
    );

    expect(await loadOrg(orgB.organizationId)).toEqual(otherBefore);
    expect((await loadOrg(orgA.organizationId)).name).toBe("Hanya Org A");
  });

  it("fails for an OWNER below the root without writing", async () => {
    const caller = sessionFor(Number(orgA.owner.id), "OWNER", { ...orgA.branch, organizationId: orgA.organizationId });
    mockAuthSession(auth, { user: caller });
    const before = await loadOrg(orgA.organizationId);
    const audits = await auditCount(orgA.organizationId);

    const result = await updateOrganizationAction(null, form({ name: "Diubah", timezone: "Asia/Jayapura" }));

    expect(result.ok).toBe(false);
    expect(await loadOrg(orgA.organizationId)).toEqual(before);
    expect(await auditCount(orgA.organizationId)).toBe(audits);
  });

  it("fails for an ADMIN at the root without writing", async () => {
    const caller = sessionFor(Number(orgA.owner.id), "ADMIN", { ...orgA.root, organizationId: orgA.organizationId });
    mockAuthSession(auth, { user: caller });
    const before = await loadOrg(orgA.organizationId);

    const result = await updateOrganizationAction(null, form({ name: "Diubah", timezone: "Asia/Jayapura" }));

    expect(result.ok).toBe(false);
    expect(await loadOrg(orgA.organizationId)).toEqual(before);
  });

  it("returns a validation error for a blank name", async () => {
    mockAuthSession(auth, { user: orgA.owner });
    const before = await loadOrg(orgA.organizationId);

    const result = await updateOrganizationAction(null, form({ name: "   ", timezone: "Asia/Jakarta" }));

    expect(result).toEqual({ ok: false, error: "Nama wajib diisi" });
    expect((await loadOrg(orgA.organizationId)).name).toBe(before.name);
  });

  it("returns a validation error for an unsupported timezone", async () => {
    mockAuthSession(auth, { user: orgA.owner });

    const result = await updateOrganizationAction(null, form({ name: "Org", timezone: "Europe/London" }));

    expect(result).toEqual({ ok: false, error: "Zona waktu tidak didukung" });
  });
});
