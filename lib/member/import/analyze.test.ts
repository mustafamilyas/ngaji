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
  let session: ReturnType<typeof sessionFor>;

  beforeAll(async () => {
    fx = await buildPageFixture("import-analyze");
    session = sessionFor(fx.actorId, "ADMIN", fx.branch);
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

  it("does not support a grup column yet", async () => {
    const result = await analyzeImport(session, csv(`${HEADER},grup`, `${line("Grup Dulu")},Leaf`), fx.leaf.id);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("grup") });
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
