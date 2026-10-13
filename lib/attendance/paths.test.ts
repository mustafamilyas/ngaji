import { describe, expect, it } from "vitest";
import { CHECK_IN_PATH_RE, checkInPath } from "./paths";

describe("CHECK_IN_PATH_RE", () => {
  it("matches the path built by checkInPath", () => {
    expect(CHECK_IN_PATH_RE.test(checkInPath(12, "2026-10-13"))).toBe(true);
  });

  it.each(["/kegiatan/12/2026-10-13/absen", "/dashboard/kegiatan/12/2026-10-13", "/dashboard/kegiatan/x/2026-10-13/absen"])(
    "does not match %s",
    (path) => {
      expect(CHECK_IN_PATH_RE.test(path)).toBe(false);
    },
  );
});
