/** Cookie holding the desktop sidebar's collapsed state ("1" = collapsed), read server-side to avoid a flash on load. */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";

export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dasbor" },
  { href: "/grup", label: "Grup" },
  { href: "/anggota", label: "Anggota" },
  { href: "/kegiatan", label: "Kegiatan" },
  { href: "/statistik", label: "Statistik" },
  { href: "/pengguna", label: "Pengguna" },
  { href: "/audit", label: "Audit Log" },
];
