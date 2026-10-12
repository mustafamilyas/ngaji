import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// The toolbar is a client component that calls useRouter(); there is no app router when rendering to static markup.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { encodeDraft } from "@/lib/member-view/draft";
import { buildPageFixture, mockAuthSession, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { emptyDefinition, type Definition } from "@/lib/validation/member-view";
import MemberViewPage from "./page";

async function makeView(fixture: PageFixture, name: string, definition: Definition, groupId = fixture.leaf.id) {
  const owner = await db.user.create({ data: { username: `${name}-owner`, passwordHash: "x", name: "Pemilik Uji" } });
  await db.userGroupRole.create({ data: { userId: owner.id, groupId, role: "USER" } });
  const view = await db.memberView.create({
    data: { groupId, ownerId: owner.id, createdById: owner.id, name, definition: definition as unknown as Prisma.InputJsonValue },
  });
  return { view, owner };
}

async function addMember(fixture: PageFixture, name: string, sex: "L" | "P", groupId = fixture.leaf.id) {
  return db.member.create({
    data: {
      groupId,
      name,
      birthPlace: "Jakarta",
      birthDate: "2010-05-05",
      sex,
      address: "Jl. Rahasia No. 9",
      phone: "081299990000",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "PELAJAR_SMP",
      status: "AKTIF",
      joinedAt: "2024-01-01",
      createdById: fixture.actorId,
    },
  });
}

const render = async (id: number, searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await MemberViewPage({ params: Promise.resolve({ id: String(id) }), searchParams: Promise.resolve(searchParams) }),
  );

describe("MemberViewPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders matching members for a viewer in the view's group", async () => {
    const fixture = await buildPageFixture("tampilan-detail");
    await addMember(fixture, "Siswa Satu", "L");
    const { view, owner } = await makeView(fixture, "Daftar Uji", { ...emptyDefinition(), columns: ["status"] });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const html = await render(view.id);
    expect(html).toContain("Daftar Uji");
    expect(html).toContain("Pemilik Uji");
    expect(html).toContain("Siswa Satu");
    expect(html).toContain("Anggota Uji");
    expect(html).toContain("2 anggota");
  });

  it("renders the filter bar with a chip per rule group and the Tampilan menu", async () => {
    const fixture = await buildPageFixture("tampilan-toolbar");
    const { view, owner } = await makeView(fixture, "Dengan Filter", {
      ...emptyDefinition(),
      columns: ["status"],
      filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "age", operator: "between", value: [13, 17] }] }] },
    });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const html = await render(view.id);
    expect(html).toContain("Usia antara 13 dan 17");
    expect(html).toContain("Tambah filter");
    expect(html).toContain("Tampilan");
  });

  it("never sends a hidden PII column to the browser", async () => {
    const fixture = await buildPageFixture("tampilan-pii");
    await addMember(fixture, "Siswa Rahasia", "L");
    const { view, owner } = await makeView(fixture, "Tanpa PII", { ...emptyDefinition(), columns: ["status"] });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const html = await render(view.id);
    expect(html).toContain("Siswa Rahasia");
    expect(html).not.toContain("081299990000");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Jl. Rahasia");
  });

  it("shows a chosen PII column", async () => {
    const fixture = await buildPageFixture("tampilan-pii-shown");
    await addMember(fixture, "Siswa Terbuka", "L");
    const { view, owner } = await makeView(fixture, "Dengan Alamat", { ...emptyDefinition(), columns: ["alamat"] });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    expect(await render(view.id)).toContain("Jl. Rahasia");
  });

  it("returns 404 for a user in an ancestor group and for a deleted view", async () => {
    const fixture = await buildPageFixture("tampilan-404");
    const { view, owner } = await makeView(fixture, "Milik Kelompok", emptyDefinition());

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
    await expect(render(view.id)).rejects.toMatchObject({ digest: expect.stringContaining("404") });

    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    await db.memberView.update({ where: { id: view.id }, data: { deletedAt: new Date() } });
    await expect(render(view.id)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("returns 404 for a non-numeric id", async () => {
    const fixture = await buildPageFixture("tampilan-badid");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });
    await expect(
      MemberViewPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("renders grouped sections with counts and the first members", async () => {
    const fixture = await buildPageFixture("tampilan-grouped");
    await addMember(fixture, "Siswi Satu", "P");
    const { view, owner } = await makeView(fixture, "Per Jenis Kelamin", {
      ...emptyDefinition(),
      columns: ["status"],
      groupBy: { kind: "property", field: "sex" },
    });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const html = await render(view.id);
    expect(html).toContain("Laki-laki");
    expect(html).toContain("Perempuan");
    expect(html).toContain("1 anggota");
    expect(html).toContain("Siswi Satu");
    expect(html).toContain("Anggota Uji");
  });

  it("applies a readable URL draft and marks it unsaved, without changing the saved view", async () => {
    const fixture = await buildPageFixture("tampilan-draft");
    await addMember(fixture, "Siswi Draft", "P");
    const { view, owner } = await makeView(fixture, "Dasar", { ...emptyDefinition(), columns: ["status"] });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const draft = encodeDraft({
      ...emptyDefinition(),
      columns: ["status"],
      filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "sex", operator: "isAnyOf", value: ["P"] }] }] },
    })!;
    const html = await render(view.id, { d: draft });
    expect(html).toContain("Belum disimpan");
    expect(html).toContain("Siswi Draft");
    expect(html).not.toContain("Anggota Uji");

    const saved = await db.memberView.findUniqueOrThrow({ where: { id: view.id } });
    expect(saved.definition).toEqual({ ...emptyDefinition(), columns: ["status"] });
  });

  it("falls back to the saved definition with a notice when the draft is tampered", async () => {
    const fixture = await buildPageFixture("tampilan-tampered");
    const { view, owner } = await makeView(fixture, "Tersimpan", { ...emptyDefinition(), columns: ["status"] });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const html = await render(view.id, { d: "bukan-draft-valid!!" });
    expect(html).toContain("tidak dapat dibaca");
    expect(html).not.toContain("Belum disimpan");
    expect(html).toContain("Anggota Uji");
  });

  it("ignores a stale group rule and shows the notice instead of failing", async () => {
    const fixture = await buildPageFixture("tampilan-stale");
    const { view, owner } = await makeView(fixture, "Basi", {
      ...emptyDefinition(),
      columns: ["status"],
      filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "group", operator: "inSubtreeOf", value: [fixture.root.id] }] }] },
    });
    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

    const html = await render(view.id);
    expect(html).toContain("Beberapa aturan diabaikan karena tidak berlaku lagi");
    expect(html).toContain("Anggota Uji");
  });
  describe("header actions", () => {
    const draft = () => encodeDraft({ ...emptyDefinition(), columns: ["status"] })!;

    it("shows the owner every control, and Simpan/Batalkan only on a draft", async () => {
      const fixture = await buildPageFixture("tampilan-act-owner");
      const { view, owner } = await makeView(fixture, "Milik Saya", emptyDefinition());
      mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });

      const clean = await render(view.id);
      expect(clean).toContain("Ubah nama");
      expect(clean).toContain("Simpan sebagai baru");
      expect(clean).toContain("Zona berbahaya");
      expect(clean).not.toContain("Batalkan");
      expect(clean).not.toContain("Ambil alih");

      const edited = await render(view.id, { d: draft() });
      expect(edited).toContain("Batalkan");
    });

    it("hides owner controls from another user, even an ADMIN, but keeps Simpan sebagai baru", async () => {
      const fixture = await buildPageFixture("tampilan-act-other");
      const { view } = await makeView(fixture, "Milik Orang", emptyDefinition());
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });

      const html = await render(view.id, { d: draft() });
      expect(html).toContain("Simpan sebagai baru");
      expect(html).not.toContain("Ubah nama");
      expect(html).not.toContain("Batalkan");
      expect(html).not.toContain("Zona berbahaya");
      expect(html).not.toContain("Ambil alih");
    });

    it("offers Ambil alih to an ADMIN only when the owner is orphaned", async () => {
      const fixture = await buildPageFixture("tampilan-act-orphan");
      const { view, owner } = await makeView(fixture, "Yatim", emptyDefinition());

      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
      expect(await render(view.id)).not.toContain("Ambil alih");

      await db.user.update({ where: { id: owner.id }, data: { isActive: false } });
      expect(await render(view.id)).toContain("Ambil alih");

      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
      expect(await render(view.id)).not.toContain("Ambil alih");
    });
  });
});
