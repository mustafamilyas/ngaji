import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each(["/", "/ormas", "/login"])("allows %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each(["/dashboard/anggota", "/pengajian", "/ormas/1", "/Login", "/ormas/", "/login/", "/api/x", "/login/../anggota", ""])(
    "rejects %j",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});
