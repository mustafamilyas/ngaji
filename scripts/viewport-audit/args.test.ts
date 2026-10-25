import { describe, expect, it } from "vitest";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("defaults to the owner role, three viewports and no filter", () => {
    expect(parseArgs([])).toEqual({ roles: ["owner"], landscape: false, only: null, keepServer: false });
  });

  it("accepts a comma-separated role list", () => {
    expect(parseArgs(["--roles", "owner,admin,user"])).toMatchObject({ roles: ["owner", "admin", "user"] });
  });

  it("rejects an unknown role", () => {
    expect(parseArgs(["--roles", "root"])).toBeNull();
  });

  it("supports --landscape, --only and --keep-server", () => {
    expect(parseArgs(["--landscape", "--only", "pengaturan", "--keep-server"])).toEqual({
      roles: ["owner"],
      landscape: true,
      only: "pengaturan",
      keepServer: true,
    });
  });

  it("rejects an unknown flag or a flag missing its value", () => {
    expect(parseArgs(["--nope"])).toBeNull();
    expect(parseArgs(["--roles"])).toBeNull();
  });
});
