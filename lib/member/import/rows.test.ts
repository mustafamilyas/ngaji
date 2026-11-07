import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertRow, type RowCells } from "./rows";

const valid: RowCells = {
  nama: "Budi Santoso",
  tempat_lahir: "Bandung",
  tanggal_lahir: "05/03/1990",
  jenis_kelamin: "L",
  alamat: "Jl. Merdeka 1",
  status_nikah: "MENIKAH",
  pekerjaan: "BEKERJA",
};
const options = { groupId: 7, timeZone: "Asia/Jakarta" };

function dataOf(cells: RowCells) {
  const result = convertRow(cells, options);
  if (!("data" in result)) throw new Error(`expected data, got ${JSON.stringify(result.errors)}`);
  return result.data;
}

function errorsOf(cells: RowCells) {
  const result = convertRow(cells, options);
  if (!("errors" in result)) throw new Error("expected errors");
  return result.errors;
}

describe("convertRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-03-09 23:30 in Jakarta is still 2026-03-09, but already 2026-03-10 in UTC+8 zones.
    vi.setSystemTime(new Date("2026-03-09T16:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("converts a valid row into member input for the given group", () => {
    expect(dataOf(valid)).toMatchObject({
      name: "Budi Santoso",
      birthPlace: "Bandung",
      birthDate: "1990-03-05",
      sex: "L",
      address: "Jl. Merdeka 1",
      maritalStatus: "MENIKAH",
      workStatus: "BEKERJA",
      groupId: 7,
    });
  });

  it("accepts Indonesian labels for enums, ignoring case", () => {
    const data = dataOf({ ...valid, jenis_kelamin: "perempuan", status_nikah: "Belum Menikah", pekerjaan: "pelajar smp" });
    expect(data).toMatchObject({ sex: "P", maritalStatus: "BELUM_MENIKAH", workStatus: "PELAJAR_SMP" });
  });

  it("reports an unknown enum value on its own column", () => {
    expect(errorsOf({ ...valid, jenis_kelamin: "X" })).toEqual([
      { column: "jenis_kelamin", message: "Nilai tidak dikenal" },
    ]);
  });

  it("defaults status to AKTIF and joined date to today in the organization's time zone", () => {
    expect(dataOf(valid)).toMatchObject({ status: "AKTIF", joinedAt: "2026-03-09" });
    const east = convertRow(valid, { groupId: 7, timeZone: "Asia/Makassar" });
    expect(east).toMatchObject({ data: { joinedAt: "2026-03-10" } });
  });

  it("reads status, joined date, and exit date when given", () => {
    const data = dataOf({ ...valid, status: "keluar", tanggal_masuk: "1/1/2020", tanggal_keluar: "2021-06-30" });
    expect(data).toMatchObject({ status: "KELUAR", joinedAt: "2020-01-01", exitedAt: "2021-06-30" });
  });

  it("requires the exit date when status is not AKTIF", () => {
    const errors = errorsOf({ ...valid, status: "KELUAR" });
    expect(errors.map((error) => error.column)).toEqual(["tanggal_keluar"]);
  });

  it("reports an impossible birth date", () => {
    expect(errorsOf({ ...valid, tanggal_lahir: "31/02/1990" })).toEqual([
      { column: "tanggal_lahir", message: "Tanggal tidak valid" },
    ]);
  });

  it("reports a bad optional date only when the cell is filled", () => {
    expect(errorsOf({ ...valid, tanggal_masuk: "05/03/90" })).toEqual([
      { column: "tanggal_masuk", message: "Tanggal tidak valid" },
    ]);
  });

  it("rejects a phone number damaged by scientific notation", () => {
    expect(errorsOf({ ...valid, no_hp: "6.28E+11" })).toEqual([
      { column: "no_hp", message: "Nomor HP tidak valid" },
    ]);
  });

  it("keeps a normal phone number and leaves an empty one out", () => {
    expect(dataOf({ ...valid, no_hp: " 081234567890 " }).phone).toBe("081234567890");
    expect(dataOf({ ...valid, no_hp: "" }).phone).toBeUndefined();
  });

  it("names every required column that is empty", () => {
    const errors = errorsOf({ ...valid, nama: " ", alamat: "", jenis_kelamin: "" });
    expect(errors).toEqual([
      { column: "nama", message: "Wajib diisi" },
      { column: "jenis_kelamin", message: "Wajib diisi" },
      { column: "alamat", message: "Wajib diisi" },
    ]);
  });

  it("reports an invalid email", () => {
    expect(errorsOf({ ...valid, email: "bukan-email" }).map((error) => error.column)).toEqual(["email"]);
  });

  it("repeats no cell value in its errors", () => {
    const errors = errorsOf({ ...valid, nama: "", tanggal_lahir: "rahasia", email: "rahasia", no_hp: "9.9E+9" });
    expect(JSON.stringify(errors)).not.toContain("rahasia");
    expect(JSON.stringify(errors)).not.toContain("9.9E+9");
  });
});
