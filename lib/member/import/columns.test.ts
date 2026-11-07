import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, matchColumns } from "./columns";

const REQUIRED = ["nama", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "alamat", "status_nikah", "pekerjaan"];

describe("IMPORT_COLUMNS", () => {
  it("lists the required columns from the spec", () => {
    expect(IMPORT_COLUMNS.filter((column) => column.required).map((column) => column.key)).toEqual(REQUIRED);
  });

  it("lists the optional columns from the spec, including grup", () => {
    expect(IMPORT_COLUMNS.filter((column) => !column.required).map((column) => column.key)).toEqual([
      "no_hp",
      "email",
      "status",
      "tanggal_masuk",
      "tanggal_keluar",
      "grup",
    ]);
  });
});

describe("matchColumns", () => {
  it("maps each column to its position in the file", () => {
    const { indexes } = matchColumns(["alamat", ...REQUIRED.filter((key) => key !== "alamat")]);
    expect(indexes.alamat).toBe(0);
    expect(indexes.nama).toBe(1);
  });

  it.each(["Tanggal Lahir", "TANGGAL_LAHIR", "  tanggal lahir ", "Tanggal  Lahir", "tanggal _ lahir"])(
    "reads the header %j as tanggal_lahir",
    (header) => {
      expect(matchColumns([header]).indexes.tanggal_lahir).toBe(0);
    },
  );

  it("reports nothing missing when only optional columns are absent", () => {
    expect(matchColumns(REQUIRED).missing).toEqual([]);
  });

  it("reports a missing required column", () => {
    const headers = REQUIRED.filter((key) => key !== "alamat");
    expect(matchColumns(headers).missing).toEqual(["alamat"]);
  });

  it("reads grup as an optional column", () => {
    const { indexes, missing } = matchColumns([...REQUIRED, "Grup"]);
    expect(indexes.grup).toBe(REQUIRED.length);
    expect(missing).toEqual([]);
  });

  it("leaves grup unset when the file has no such column", () => {
    expect(matchColumns(REQUIRED).indexes.grup).toBeUndefined();
  });

  it("names unknown columns as ignored, as the file wrote them", () => {
    const { ignored, indexes } = matchColumns([...REQUIRED, " Catatan "]);
    expect(ignored).toEqual(["Catatan"]);
    expect(indexes).not.toHaveProperty("catatan");
  });

  it("does not report blank headers from trailing separators", () => {
    expect(matchColumns([...REQUIRED, "", "  "]).ignored).toEqual([]);
  });

  it("reports a column that appears twice, once", () => {
    const { repeated } = matchColumns([...REQUIRED, "Tanggal Lahir", "TANGGAL LAHIR"]);
    expect(repeated).toEqual(["tanggal_lahir"]);
  });

  it("reports no repeated columns for a clean header", () => {
    expect(matchColumns(REQUIRED).repeated).toEqual([]);
  });
});
