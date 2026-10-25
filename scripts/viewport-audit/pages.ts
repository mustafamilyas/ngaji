/** Which pages and screen sizes the viewport audit walks. */

export type Viewport = { width: number; height: number };

const DEFAULT_VIEWPORTS: Viewport[] = [
  { width: 360, height: 740 }, // phone
  { width: 768, height: 1024 }, // tablet portrait
  { width: 1024, height: 768 }, // tablet landscape
];

const LANDSCAPE_PHONES: Viewport[] = [
  { width: 667, height: 375 },
  { width: 812, height: 375 },
];

export const viewportsFor = (landscape: boolean): Viewport[] =>
  landscape ? [...DEFAULT_VIEWPORTS, ...LANDSCAPE_PHONES] : DEFAULT_VIEWPORTS;

/** Ids of seeded rows that the detail pages need; null when the seed has no such row. */
export type SeedIds = {
  memberId: number | null;
  branchGroupId: number | null;
  leafGroupId: number | null;
  activityId: number | null;
  attendanceDate: string | null;
  surveyId: number | null;
  viewId: number | null;
};

export type AuditPage = { path: string; anonymous: boolean };

export function buildPageList(ids: SeedIds): AuditPage[] {
  const anonymous = ["/", "/ormas", "/login", "/daftar"].map((path) => ({ path, anonymous: true }));
  const paths: string[] = [
    "/dashboard",
    "/dashboard/anggota",
    "/dashboard/anggota/baru",
    "/dashboard/pengguna",
    "/dashboard/survei",
    "/dashboard/survei/baru",
    "/dashboard/tampilan",
    "/dashboard/tampilan/baru",
    "/dashboard/kegiatan",
    "/dashboard/kegiatan?view=calendar",
    "/dashboard/kegiatan/baru",
    "/dashboard/kegiatan/cetak",
    "/dashboard/grup",
    "/dashboard/statistik?tab=anggota",
    "/dashboard/statistik?tab=kegiatan",
    "/dashboard/statistik?tab=partisipasi",
    "/dashboard/audit",
    "/dashboard/pengaturan",
    "/dashboard/akun/password",
  ];

  if (ids.memberId !== null) {
    for (const tab of ["", "?tab=kehadiran", "?tab=ubah"]) paths.push(`/dashboard/anggota/${ids.memberId}${tab}`);
  }
  for (const groupId of [ids.branchGroupId, ids.leafGroupId]) {
    if (groupId === null) continue;
    for (const tab of ["subgrup", "anggota", "kegiatan", "pengguna", "pengaturan"]) {
      paths.push(`/dashboard/grup/${groupId}?tab=${tab}`);
    }
  }
  if (ids.activityId !== null) {
    const base = `/dashboard/kegiatan/${ids.activityId}`;
    paths.push(base, `${base}?tab=jadwal`, `${base}?tab=pengaturan`, `${base}/geser`);
    if (ids.attendanceDate !== null) paths.push(`${base}/${ids.attendanceDate}`);
  }
  if (ids.surveyId !== null) {
    const base = `/dashboard/survei/${ids.surveyId}`;
    paths.push(base, `${base}?tab=responden`, `${base}?tab=formulir`, `${base}/isi`);
  }
  if (ids.viewId !== null) paths.push(`/dashboard/tampilan/${ids.viewId}`);

  return [...anonymous, ...[...new Set(paths)].map((path) => ({ path, anonymous: false }))];
}
