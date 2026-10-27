import { describe, expect, it } from "vitest";
import { DEFAULT_PORT, parseArgs } from "./args";

describe("parseArgs", () => {
  it("defaults to port 3100 and deleting the database on exit", () => {
    expect(parseArgs([])).toEqual({ port: DEFAULT_PORT, keep: false });
    expect(DEFAULT_PORT).toBe(3100);
  });

  it("accepts --port and --keep", () => {
    expect(parseArgs(["--port", "4200", "--keep"])).toEqual({ port: 4200, keep: true });
  });

  it("rejects a missing, non-numeric, fractional or out-of-range port", () => {
    for (const value of ["abc", "3100.5", "80", "70000", "-1", ""]) {
      expect(parseArgs(["--port", value]), value).toBeNull();
    }
    expect(parseArgs(["--port"])).toBeNull();
  });

  it("rejects an unknown flag", () => {
    expect(parseArgs(["--nope"])).toBeNull();
    expect(parseArgs(["3100"])).toBeNull();
  });
});
