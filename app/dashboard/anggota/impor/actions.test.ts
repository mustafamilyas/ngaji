import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, type PageFixture, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { auth } from "@/auth";
import { confirmMemberImportAction, previewMemberImportAction } from "./actions";

const HEADER = "nama,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,status_nikah,pekerjaan";
const line = (name: string, birth = "05/03/1990") => `${name},Bandung,${birth},L,Jl. Merdeka 1,MENIKAH,BEKERJA`;

function form(groupId: number | string | undefined, lines: string[], extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("file", new File([[HEADER, ...lines].join("\n")], "anggota.csv"));
  if (groupId !== undefined) data.set("groupId", String(groupId));
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

describe("member import actions", () => {
  let fx: PageFixture;
  let other: PageFixture;

  beforeAll(async () => {
    fx = await buildPageFixture("import-actions-a");
    other = await buildPageFixture("import-actions-b");
  });

  beforeEach(() => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  // Scoped to this file's organizations: test.db is shared, and other files create similarly named members.
  const countNamed = (prefix: string) =>
    db.member.count({
      where: { name: { startsWith: prefix }, group: { organizationId: { in: [fx.organizationId, other.organizationId] } } },
    });

  describe("unauthenticated", () => {
    it("redirects both actions to login and creates nothing", async () => {
      mockAuthSession(auth, null);
      await expect(previewMemberImportAction(form(fx.leaf.id, [line("Anon Satu")]))).rejects.toThrow("NEXT_REDIRECT");
      await expect(confirmMemberImportAction(form(fx.leaf.id, [line("Anon Satu")]))).rejects.toThrow("NEXT_REDIRECT");
      expect(await countNamed("Anon ")).toBe(0);
    });
  });

  describe.each([
    ["preview", previewMemberImportAction],
    ["confirm", confirmMemberImportAction],
  ])("%s group checks", (_name, action) => {
    it("answers not found for a group outside the user's scope", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.leaf) });
      const result = await action(form(fx.otherLeaf.id, [line("Luar Lingkup")]));
      expect(result.ok).toBe(false);
      expect(await countNamed("Luar Lingkup")).toBe(0);
    });

    it("answers the same for a group of another organization", async () => {
      const outside = await action(form(other.leaf.id, [line("Luar Organisasi")]));
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.leaf) });
      const sibling = await action(form(fx.otherLeaf.id, [line("Luar Organisasi")]));
      expect(outside).toEqual(sibling);
      expect(await countNamed("Luar Organisasi")).toBe(0);
    });

    it("rejects a group that is not a leaf", async () => {
      const result = await action(form(fx.branch.id, [line("Bukan Daun")]));
      expect(result.ok).toBe(false);
      expect(await countNamed("Bukan Daun")).toBe(0);
    });

    it("rejects a missing or malformed group id", async () => {
      expect((await action(form(undefined, [line("Tanpa Grup")]))).ok).toBe(false);
      expect((await action(form("abc", [line("Tanpa Grup")]))).ok).toBe(false);
    });

    it("rejects a request without a file", async () => {
      const data = new FormData();
      data.set("groupId", String(fx.leaf.id));
      expect((await action(data)).ok).toBe(false);
    });
  });

  describe("preview", () => {
    it("reports counts and creates nothing", async () => {
      const result = await previewMemberImportAction(form(fx.leaf.id, [line("Pratinjau Satu"), line("Pratinjau Dua", "xx")]));
      expect(result).toMatchObject({ ok: true, data: { validCount: 1, invalidCount: 1, totalErrors: 1 } });
      expect(await countNamed("Pratinjau ")).toBe(0);
    });
  });

  describe("confirm", () => {
    it("creates the members in the chosen group with audit entries sharing one importId", async () => {
      const result = await confirmMemberImportAction(form(fx.leaf.id, [line("Konfirmasi Satu"), line("Konfirmasi Dua", "1991-02-03")]));
      if (!result.ok || result.data.status !== "done") throw new Error(JSON.stringify(result));
      expect(result.data).toMatchObject({ created: 2, skipped: 0, groupId: fx.leaf.id });

      const members = await db.member.findMany({ where: { name: { startsWith: "Konfirmasi " }, groupId: fx.leaf.id } });
      expect(members.map((member) => member.groupId)).toEqual([fx.leaf.id, fx.leaf.id]);
      const audits = await db.auditLog.findMany({ where: { action: "member.create", entityId: { in: members.map((m) => m.id) } } });
      expect(new Set(audits.map((a) => (a.meta as { importId: string }).importId))).toEqual(new Set([result.data.importId]));
    });

    it("skips duplicates unless Tetap impor is ticked", async () => {
      const lines = [line("Ulang Satu"), line("Ulang Dua", "1991-02-03")];
      await confirmMemberImportAction(form(fx.leaf.id, lines));

      const again = await confirmMemberImportAction(form(fx.leaf.id, lines));
      expect(again.ok).toBe(false);
      expect(await countNamed("Ulang ")).toBe(2);

      const forced = await confirmMemberImportAction(form(fx.leaf.id, lines, { force: "on" }));
      expect(forced).toMatchObject({ ok: true, data: { status: "done", created: 2, skipped: 0 } });
      expect(await countNamed("Ulang ")).toBe(4);
    });
  });

  describe("confirm re-validates", () => {
    it("creates nothing when one of 100 rows is invalid, even without a preview", async () => {
      const lines = Array.from({ length: 100 }, (_, i) =>
        line(`Seratus ${i}`, i === 49 ? "31/02/1990" : "05/03/1990"),
      );
      const result = await confirmMemberImportAction(form(fx.leaf.id, lines));

      expect(result).toMatchObject({
        ok: true,
        data: { status: "invalid", report: { validCount: 99, invalidCount: 1, errors: [{ rowNumber: 51, column: "tanggal_lahir" }] } },
      });
      expect(await countNamed("Seratus ")).toBe(0);
    });
  });

  describe("logging", () => {
    const channels = ["log", "info", "warn", "error", "debug"] as const;
    const spies = channels.map((channel) => vi.spyOn(console, channel).mockImplementation(() => {}));
    // JSON.stringify turns an Error into "{}", so render errors by message and stack.
    const render = (arg: unknown) => (arg instanceof Error ? `${arg.message}\n${arg.stack}` : JSON.stringify(arg));
    const logged = () => spies.flatMap((spy) => spy.mock.calls.flat().map(render)).join("\n").toLowerCase();

    beforeEach(() => spies.forEach((spy) => spy.mockClear()));
    afterAll(() => spies.forEach((spy) => spy.mockRestore()));

    it("keeps cell values out of the logs for valid, invalid, and rejected requests", async () => {
      await previewMemberImportAction(form(fx.leaf.id, [line("Rahasia Valid")]));
      await confirmMemberImportAction(form(fx.leaf.id, [line("Rahasia Konfirmasi", "1991-04-05")]));
      await previewMemberImportAction(form(fx.leaf.id, [line("Rahasia Salah", "tanggal-rahasia")]));
      await confirmMemberImportAction(form(fx.leaf.id, [line("Rahasia Salah", "tanggal-rahasia")]));
      await previewMemberImportAction(form(fx.branch.id, [line("Rahasia Cabang")]));
      const bad = new FormData();
      bad.set("file", new File([`${HEADER}\n"Rahasia Kutip,x`], "anggota.csv"));
      bad.set("groupId", String(fx.leaf.id));
      await previewMemberImportAction(bad);

      expect(logged()).not.toContain("rahasia");
    });

    it("keeps cell values out of the logs when the write fails unexpectedly", async () => {
      // Prisma's own messages quote the arguments of the failed call, which hold member data.
      vi.spyOn(db, "$transaction").mockRejectedValueOnce(
        new Error('Invalid `prisma.member.create()` invocation: { data: { name: "Rahasia Gagal" } }'),
      );

      // The failure must really happen, or the log assertion below proves nothing.
      const result = await confirmMemberImportAction(form(fx.leaf.id, [line("Rahasia Gagal", "1992-06-07")]));
      expect(result).toEqual({ ok: false, error: "Impor gagal. Coba lagi." });
      expect(await countNamed("Rahasia Gagal")).toBe(0);

      expect(logged()).not.toContain("rahasia");
    });
  });
});
