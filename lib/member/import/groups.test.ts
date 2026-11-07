import { describe, expect, it } from "vitest";
import { createGroupResolver } from "./groups";

const leaves = [
  { id: 11, name: "Kelompok 1" },
  { id: 12, name: "Kelompok 2" },
  { id: 21, name: "Kelompok 3" },
  { id: 22, name: "Kelompok 3" },
];
const resolve = createGroupResolver(leaves);

describe("createGroupResolver", () => {
  it("resolves a unique name to its group id", () => {
    expect(resolve("Kelompok 2")).toEqual({ groupId: 12 });
  });

  it("ignores case, outer spaces, and repeated spaces", () => {
    expect(resolve("  kelompok   1 ")).toEqual({ groupId: 11 });
  });

  it("reports a blank cell as missing", () => {
    expect(resolve("")).toEqual({ error: "Wajib diisi" });
    expect(resolve("   ")).toEqual({ error: "Wajib diisi" });
  });

  it("reports an unknown name", () => {
    expect(resolve("Kelompok 9")).toEqual({ error: "Grup tidak ditemukan" });
  });

  it("reports a name shared by several leaf groups as ambiguous", () => {
    expect(resolve("Kelompok 3")).toEqual({ error: "Nama grup lebih dari satu" });
  });

  it("reports the same error for any name missing from the list given (out of scope, non-leaf, other organization)", () => {
    expect(resolve("Desa Sukamaju")).toEqual(resolve("Nama yang tidak ada"));
  });

  it("repeats no cell value in its error", () => {
    expect(JSON.stringify(resolve("rahasia"))).not.toContain("rahasia");
  });

  it("resolves nothing from an empty list", () => {
    expect(createGroupResolver([])("Kelompok 1")).toEqual({ error: "Grup tidak ditemukan" });
  });
});
