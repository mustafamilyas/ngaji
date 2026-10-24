import { describe, expect, it } from "vitest";
import { loginBrand } from "./login-brand";

const alIkhlas = { name: "Pengajian Al-Ikhlas" };
const anNur = { name: "Majelis An-Nur" };

describe("loginBrand", () => {
  it("is generic when the flag is unset, even with one organization", () => {
    expect(loginBrand(undefined, [alIkhlas])).toBe("Dahan");
  });

  it("is generic when the flag is anything other than the exact string true", () => {
    for (const flag of ["", "false", "1", "TRUE", "True", " true"]) {
      expect(loginBrand(flag, [alIkhlas])).toBe("Dahan");
    }
  });

  it("shows the organization name when the flag is true and exactly one organization exists", () => {
    expect(loginBrand("true", [alIkhlas])).toBe("Pengajian Al-Ikhlas");
  });

  it("is generic when the flag is true and several organizations exist", () => {
    expect(loginBrand("true", [alIkhlas, anNur])).toBe("Dahan");
  });

  it("is generic when the flag is true and no organization exists", () => {
    expect(loginBrand("true", [])).toBe("Dahan");
  });
});
