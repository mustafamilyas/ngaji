/** Cookie holding the desktop sidebar's collapsed state ("1" = collapsed), read server-side to avoid a flash on load. */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";

/** Home of the signed-in app; every app route lives under it, public pages do not. */
export const DASHBOARD_PATH = "/dashboard";

export type NavItem = {
  href: string;
  label: string;
  /** Shown only to an OWNER of the organization's root group. */
  rootOwnerOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: DASHBOARD_PATH, label: "Dasbor" },
  { href: "/dashboard/grup", label: "Grup" },
  { href: "/dashboard/anggota", label: "Anggota" },
  { href: "/dashboard/tampilan", label: "Tampilan" },
  { href: "/dashboard/kegiatan", label: "Kegiatan" },
  { href: "/dashboard/survei", label: "Survei" },
  { href: "/dashboard/statistik", label: "Statistik" },
  { href: "/dashboard/pengguna", label: "Pengguna" },
  { href: "/dashboard/audit", label: "Audit Log" },
  { href: "/dashboard/pengaturan", label: "Pengaturan", rootOwnerOnly: true },
];
