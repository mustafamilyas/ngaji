import { describe, expect, it } from "vitest";
import { buildPageList, viewportsFor, type SeedIds } from "./pages";

const ids: SeedIds = {
  memberId: 5,
  branchGroupId: 3,
  leafGroupId: 4,
  activityId: 7,
  attendanceDate: "2026-10-04",
  surveyId: 1,
  viewId: 2,
  keyTagId: 9,
};

describe("buildPageList", () => {
  it("covers the public pages anonymously and the dashboard pages with a session", () => {
    const pages = buildPageList(ids);
    expect(pages.filter((p) => p.anonymous).map((p) => p.path)).toEqual(["/", "/ormas", "/login", "/daftar"]);
    expect(pages.some((p) => !p.anonymous && p.path === "/dashboard/anggota")).toBe(true);
  });

  it("puts the seeded ids into the detail pages and every tab of a tabbed page", () => {
    const paths = buildPageList(ids).map((p) => p.path);
    expect(paths).toContain("/dashboard/anggota/5");
    expect(paths).toContain("/dashboard/kegiatan/7/2026-10-04");
    expect(paths).toContain("/dashboard/kegiatan/7?tab=jadwal");
    expect(paths).toContain("/dashboard/kegiatan/7?tab=pengaturan");
    expect(paths).toContain("/dashboard/grup/3?tab=subgrup");
    expect(paths).toContain("/dashboard/grup/3?tab=tag");
    expect(paths).toContain("/dashboard/statistik?tab=partisipasi");
    expect(paths).toContain("/dashboard/statistik?tab=kegiatan&rincian=sex");
    expect(paths).toContain("/dashboard/kegiatan/7?rincian=age");
    expect(paths).toContain("/dashboard/statistik?tab=kegiatan&rincian=tag:9");
    expect(paths).toContain("/dashboard/statistik?tab=anggota&tag=9");
    expect(paths).toContain("/dashboard/survei/1/isi");
  });

  it("has no duplicate paths and leaves out pages whose seed id is missing", () => {
    const paths = buildPageList({ ...ids, attendanceDate: null, viewId: null, keyTagId: null }).map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((p) => /kegiatan\/7\/\d{4}-/.test(p))).toBe(false);
    expect(paths.some((p) => p.startsWith("/dashboard/tampilan/") && p !== "/dashboard/tampilan/baru")).toBe(false);
    expect(paths.some((p) => p.includes("&tag="))).toBe(false);
  });
});

describe("viewportsFor", () => {
  it("is phone, tablet portrait and tablet landscape by default", () => {
    expect(viewportsFor(false).map((v) => `${v.width}x${v.height}`)).toEqual(["360x740", "768x1024", "1024x768"]);
  });

  it("adds the two landscape phones with --landscape", () => {
    expect(viewportsFor(true).map((v) => `${v.width}x${v.height}`)).toEqual([
      "360x740",
      "768x1024",
      "1024x768",
      "667x375",
      "812x375",
    ]);
  });
});
