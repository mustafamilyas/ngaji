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
    prompt: "Mengelola pengajian?",
    label: "Lihat contoh untuk pengajian",
    href: "/pengajian",
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

export const PENGAJIAN_LANDING: LandingContent = {
  headline: "Kelola jamaah dan pengajian rutin dari pusat sampai kelompok.",
  lead: "Dahan membantu pengurus pusat, daerah, desa, dan kelompok mencatat jamaah, mengatur jadwal pengajian rutin, dan mengabsen dari HP.",
  levels: ["Pusat", "Daerah", "Desa", "Kelompok"],
  diagramLabel:
    "Pohon grup dari pusat, daerah, desa, sampai kelompok. Satu pengajian rutin yang dibuat di pusat berlaku di semua kelompok.",
  segmentLink: null,
  steps: [
    {
      title: "Susun pusat sampai kelompok",
      body: "Daftarkan daerah, desa, dan kelompok. Jamaah terdaftar di kelompok masing-masing.",
    },
    {
      title: "Jadwalkan pengajian rutin sekali",
      body: "Pengajian rutin yang dibuat di pusat atau daerah otomatis berlaku untuk semua kelompok di bawahnya.",
    },
    {
      title: "Absen jamaah dari HP",
      body: "Pengurus kelompok mencatat hadir, izin, atau tidak hadir langsung dari ponsel.",
    },
    {
      title: "Pantau rekap kehadiran",
      body: "Pengurus desa, daerah, dan pusat melihat kehadiran jamaah di cakupannya masing-masing.",
    },
  ],
  protection: {
    title: "Data jamaah dijaga",
    intro: "Data jamaah itu data pribadi. Dahan dibuat dengan itu sebagai syarat, bukan tambahan.",
    points: PROTECTION_POINTS,
  },
  cta: {
    title: "Ingin mencoba untuk pengajian Anda?",
    body: "Ceritakan jumlah daerah, desa, dan kelompok Anda. Kami bantu menyiapkannya.",
    button: CTA_BUTTON,
  },
};
