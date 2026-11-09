import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_IMPORT_ERRORS_SHOWN, MAX_IMPORT_FILE_BYTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { buildPageFixture, type PageFixture, sessionFor } from "@/lib/test/fixtures";
import { analyzeImport } from "./analyze";

const HEADER = "nama,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,status_nikah,pekerjaan";
const line = (name: string, birth = "05/03/1990") => `${name},Bandung,${birth},L,Jl. Merdeka 1,MENIKAH,BEKERJA`;
const csv = (...lines: string[]) => new File([lines.join("\n")], "anggota.csv");

describe("analyzeImport", () => {
  let fx: PageFixture;
  let other: PageFixture;
  let session: ReturnType<typeof sessionFor>;

  async function addLeaf(parent: { id: number; path: string }, organizationId: number, name: string, deletedAt?: Date) {
    const row = await db.group.create({ data: { organizationId, parentId: parent.id, depth: 2, name, path: "", deletedAt } });
    return db.group.update({ where: { id: row.id }, data: { path: `${parent.path}${row.id}/` } });
  }

  beforeAll(async () => {
    fx = await buildPageFixture("import-analyze");
    other = await buildPageFixture("import-analyze-b");
    session = sessionFor(fx.actorId, "ADMIN", fx.branch);

    await db.group.update({ where: { id: other.leaf.id }, data: { name: "Daun Org Lain" } });
    await addLeaf(fx.branch, fx.organizationId, "Daun Dihapus", new Date());
    // Two leaves in scope with one name, under different branches.
    const secondBranch = await db.group.create({
      data: { organizationId: fx.organizationId, parentId: fx.root.id, depth: 1, name: "Branch 2", path: "" },
    });
    const secondPath = await db.group.update({ where: { id: secondBranch.id }, data: { path: `${fx.root.path}${secondBranch.id}/` } });
    await addLeaf(fx.branch, fx.organizationId, "Daun Kembar");
    await addLeaf(secondPath, fx.organizationId, "Daun Kembar");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("turns a valid file into rows for the chosen group, with counts", async () => {
    const result = await analyzeImport(session, csv(HEADER, line("Analisis Satu"), line("Analisis Dua", "1991-01-02")), fx.leaf.id);

    if (!result.ok) throw new Error(result.error);
    expect(result.report).toMatchObject({ validCount: 2, invalidCount: 0, duplicateCount: 0, totalErrors: 0, errors: [] });
    expect(result.rows.map((row) => row.data)).toMatchObject([
      { name: "Analisis Satu", birthDate: "1990-03-05", groupId: fx.leaf.id },
      { name: "Analisis Dua", birthDate: "1991-01-02", groupId: fx.leaf.id },
    ]);
  });

  it("rejects a file that is not .csv and tells the user to save as CSV", async () => {
    const result = await analyzeImport(session, new File(["x"], "anggota.xlsx"), fx.leaf.id);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("CSV") });
  });

  it("rejects a file over the size limit", async () => {
    const big = new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], "anggota.csv");
    const result = await analyzeImport(session, big, fx.leaf.id);
    expect(result.ok).toBe(false);
  });

  it("fails the file when a required column is missing, naming the column", async () => {
    const result = await analyzeImport(session, csv(HEADER.replace(",alamat", ""), "a,b,c,d,e,f"), fx.leaf.id);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("alamat") });
  });

  it("fails the file when a column appears twice", async () => {
    const result = await analyzeImport(session, csv(`${HEADER},Tanggal Lahir`, `${line("Ganda")},1990-01-01`), fx.leaf.id);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("tanggal_lahir") });
  });

  describe("with a grup column", () => {
    const withGroup = (...rows: string[]) => csv(`${HEADER},grup`, ...rows);

    it("sends each row to the leaf group it names and ignores the chosen group", async () => {
      const result = await analyzeImport(
        session,
        withGroup(`${line("Grup Satu")},Leaf`, `${line("Grup Dua", "1991-01-02")}, other  LEAF `),
        undefined,
      );
      if (!result.ok) throw new Error(result.error);
      expect(result.report).toMatchObject({ validCount: 2, invalidCount: 0, usedGroupColumn: true });
      expect(result.rows.map((row) => row.data.groupId)).toEqual([fx.leaf.id, fx.otherLeaf.id]);
    });

    it("reports a blank cell as a missing group on that row", async () => {
      const result = await analyzeImport(session, withGroup(`${line("Grup Kosong")},`), fx.leaf.id);
      if (!result.ok) throw new Error(result.error);
      expect(result.report.errors).toEqual([{ rowNumber: 2, column: "grup", message: "Wajib diisi" }]);
    });

    it("reports a name matching two leaf groups as ambiguous", async () => {
      // Needs a scope that holds both branches.
      const wide = sessionFor(fx.actorId, "ADMIN", fx.root);
      const result = await analyzeImport(wide, withGroup(`${line("Grup Kembar")},Daun Kembar`), undefined);
      if (!result.ok) throw new Error(result.error);
      expect(result.report.errors).toEqual([{ rowNumber: 2, column: "grup", message: "Nama grup lebih dari satu" }]);
    });

    it("gives unknown, out-of-scope, other-organization, soft-deleted, and non-leaf names the same error", async () => {
      const narrow = sessionFor(fx.actorId, "ADMIN", fx.leaf);
      const errorFor = async (user: typeof session, name: string) => {
        const result = await analyzeImport(user, withGroup(`${line("Grup Salah")},${name}`), undefined);
        if (!result.ok) throw new Error(result.error);
        return result.report.errors;
      };
      const expected = [{ rowNumber: 2, column: "grup", message: "Grup tidak ditemukan" }];

      expect(await errorFor(session, "Tidak Ada")).toEqual(expected);
      expect(await errorFor(narrow, "Other Leaf")).toEqual(expected); // same organization, outside scope
      expect(await errorFor(session, "Daun Org Lain")).toEqual(expected); // another organization
      expect(await errorFor(session, "Daun Dihapus")).toEqual(expected); // soft-deleted
      expect(await errorFor(session, "Branch")).toEqual(expected); // not a leaf
    });

    it("reports the group error together with the row's other errors", async () => {
      const result = await analyzeImport(session, withGroup(`${line("Dua Salah", "31/02/1990")},Tidak Ada`), undefined);
      if (!result.ok) throw new Error(result.error);
      expect(result.report.errors.map((error) => error.column)).toEqual(["tanggal_lahir", "grup"]);
      expect(result.report.invalidCount).toBe(1);
    });
  });

  it("names ignored columns without storing their values", async () => {
    const result = await analyzeImport(session, csv(`${HEADER},catatan`, `${line("Catatan Satu")},rahasia`), fx.leaf.id);
    if (!result.ok) throw new Error(result.error);
    expect(result.report.ignoredColumns).toEqual(["catatan"]);
    expect(JSON.stringify(result.rows)).not.toContain("rahasia");
  });

  it("reports an invalid row by spreadsheet row number and column, without its value", async () => {
    const result = await analyzeImport(
      session,
      csv(HEADER, line("Baris Dua"), line("Baris Tiga"), line("Baris Empat", "31/02/1990")),
      fx.leaf.id,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.report.validCount).toBe(2);
    expect(result.report.invalidCount).toBe(1);
    expect(result.report.errors).toEqual([{ rowNumber: 4, column: "tanggal_lahir", message: "Tanggal tidak valid" }]);
    expect(JSON.stringify(result.report)).not.toContain("31/02/1990");
  });

  it("lists at most the display limit of errors and states the total", async () => {
    const bad = Array.from({ length: MAX_IMPORT_ERRORS_SHOWN + 5 }, (_, i) => line(`Salah ${i}`, "bukan-tanggal"));
    const result = await analyzeImport(session, csv(HEADER, ...bad), fx.leaf.id);
    if (!result.ok) throw new Error(result.error);
    expect(result.report.errors).toHaveLength(MAX_IMPORT_ERRORS_SHOWN);
    expect(result.report.totalErrors).toBe(MAX_IMPORT_ERRORS_SHOWN + 5);
  });

  it("marks rows matching an existing member in scope, and later copies within the file", async () => {
    await db.member.create({
      data: {
        groupId: fx.leaf.id, name: "Sudah Ada", birthPlace: "Jakarta", birthDate: "1980-05-06", sex: "L", address: "-",
        maritalStatus: "MENIKAH", workStatus: "BEKERJA", joinedAt: "2024-01-01", createdById: fx.actorId,
      },
    });
    const result = await analyzeImport(
      session,
      csv(HEADER, line("sudah  ada", "06/05/1980"), line("Baru Sekali", "1985-01-01"), line("BARU SEKALI", "01/01/1985")),
      fx.leaf.id,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.map((row) => row.duplicate)).toEqual([true, false, true]);
    expect(result.report.duplicateCount).toBe(2);
  });

  it("rejects the import when no group is chosen", async () => {
    await expect(analyzeImport(session, csv(HEADER, line("Tanpa Grup")), undefined)).rejects.toBeInstanceOf(ValidationError);
  });
});
