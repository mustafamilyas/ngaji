import { describe, expect, it } from "vitest";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("defaults to every scenario, no images and a temp output folder", () => {
    expect(parseArgs([])).toEqual({ only: null, out: null, png: false, keepServer: false });
  });

  it("accepts --only, --out, --png and --keep-server", () => {
    expect(parseArgs(["--only", "week", "--out", "/tmp/prints", "--png", "--keep-server"])).toEqual({
      only: "week",
      out: "/tmp/prints",
      png: true,
      keepServer: true,
    });
  });

  it("rejects an unknown flag or a flag missing its value", () => {
    expect(parseArgs(["--nope"])).toBeNull();
    expect(parseArgs(["--only"])).toBeNull();
    expect(parseArgs(["--out"])).toBeNull();
  });
});
