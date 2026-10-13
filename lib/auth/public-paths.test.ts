import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each(["/", "/pengajian", "/login"])("allows %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each(["/dashboard/anggota", "/pengajian/1", "/Login", "/pengajian/", "/login/", "/api/x", "/login/../anggota", ""])(
    "rejects %j",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});
