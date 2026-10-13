export type LandingContent = {
  headline: string;
  lead: string;
  /** Level names shown beside the hierarchy diagram, top to bottom. */
  levels: [string, string, string, string];
  diagramLabel: string;
  /** Optional line under the hero pointing at the other landing page. */
  segmentLink: { prompt: string; label: string; href: string } | null;
  steps: { title: string; body: string }[];
  protection: { title: string; intro: string; points: string[] };
  cta: { title: string; body: string; button: string };
};

const PROTECTION_POINTS = [
  "Setiap perubahan tercatat di log audit: siapa yang mengubah, kapan, dan apa yang berubah.",
  "Tidak ada penghapusan permanen. Data yang dihapus tetap tersimpan di riwayat.",
  "Pengurus hanya melihat data di cakupan grupnya sendiri.",
  "Data setiap organisasi disimpan terpisah dari organisasi lain.",
  "Dirancang dengan memperhatikan Undang-Undang Pelindungan Data Pribadi (UU PDP).",
];

const CTA_BUTTON = "Hubungi via WhatsApp";

export const GENERIC_LANDING: LandingContent = {
  headline: "Kelola anggota dan kegiatan organisasi yang berjenjang.",
  lead: "Dahan membantu organisasi dengan banyak tingkat, dari pusat sampai kelompok terkecil, mengatur anggota, jadwal kegiatan, dan absensi di satu tempat.",
  levels: ["Pusat", "Wilayah", "Cabang", "Kelompok"],
  diagramLabel:
    "Pohon grup empat tingkat. Satu kegiatan yang dibuat di tingkat teratas berlaku di semua grup di bawahnya.",
  segmentLink: {
    prompt: "Mengelola ormas?",
    label: "Lihat contoh untuk ormas",
    href: "/ormas",
  },
  steps: [
    {
      title: "Susun pohon grup",
      body: "Buat tingkatan dari pusat sampai kelompok terkecil. Anggota terdaftar di kelompok paling bawah.",
    },
    {
      title: "Atur kegiatan sekali",
      body: "Kegiatan yang dibuat di satu tingkat otomatis berlaku untuk semua grup di bawahnya.",
    },
    {
      title: "Absen dari HP",
      body: "Pengurus mencatat kehadiran langsung dari ponsel saat kegiatan berlangsung.",
    },
    {
      title: "Lihat rekap di atas",
      body: "Statistik anggota dan kehadiran terkumpul naik tingkat demi tingkat, sesuai cakupan tiap pengurus.",
    },
  ],
  protection: {
    title: "Data anggota dijaga",
    intro: "Data anggota itu data pribadi. Dahan dibuat dengan itu sebagai syarat, bukan tambahan.",
    points: PROTECTION_POINTS,
  },
  cta: {
    title: "Ingin mencoba untuk organisasi Anda?",
    body: "Ceritakan struktur organisasi Anda. Kami bantu menyiapkannya.",
    button: CTA_BUTTON,
  },
};

export const ORMAS_LANDING: LandingContent = {
  headline: "Kelola anggota ormas dari pimpinan pusat sampai cabang.",
  lead: "Dahan membantu pengurus pusat, wilayah, daerah, dan cabang mendata anggota, menjadwalkan rapat dan kegiatan rutin, serta mengabsen peserta dari HP.",
  levels: ["Pusat", "Wilayah", "Daerah", "Cabang"],
  diagramLabel:
    "Pohon grup dari pimpinan pusat, wilayah, daerah, sampai cabang. Satu kegiatan yang dibuat di pusat berlaku di semua cabang.",
  segmentLink: null,
  steps: [
    {
      title: "Susun pusat sampai cabang",
      body: "Daftarkan pimpinan wilayah, daerah, dan cabang. Anggota terdaftar di cabang masing-masing.",
    },
    {
      title: "Jadwalkan kegiatan sekali",
      body: "Rapat rutin atau kaderisasi yang dibuat di pusat atau wilayah otomatis berlaku untuk semua cabang di bawahnya.",
    },
    {
      title: "Absen peserta dari HP",
      body: "Pengurus cabang mencatat kehadiran anggota langsung dari ponsel saat kegiatan berlangsung.",
    },
    {
      title: "Pantau rekap tiap jenjang",
      body: "Pimpinan daerah, wilayah, dan pusat melihat jumlah anggota dan kehadiran di cakupannya masing-masing.",
    },
  ],
  protection: {
    title: "Data anggota dijaga",
    intro: "Data anggota itu data pribadi. Dahan dibuat dengan itu sebagai syarat, bukan tambahan.",
    points: PROTECTION_POINTS,
  },
  cta: {
    title: "Ingin mencoba untuk ormas Anda?",
    body: "Ceritakan jumlah wilayah, daerah, dan cabang Anda. Kami bantu menyiapkannya.",
    button: CTA_BUTTON,
  },
};
