import bcrypt from "bcrypt";
import { db } from "../lib/db";
import { BCRYPT_COST } from "../lib/constants";
import type { Role } from "../lib/validation/enums";

const LEVEL_NAMES = ["pusat", "daerah", "desa", "kelompok"];

const MALE_NAMES = [
  "Ahmad Fauzi",
  "Budi Santoso",
  "Candra Wijaya",
  "Dedi Kurniawan",
  "Eko Prasetyo",
  "Fajar Nugroho",
  "Gunawan Saputra",
  "Hendra Setiawan",
  "Irfan Hakim",
  "Joko Susanto",
  "Kurniawan Ramadhan",
  "Lukman Hakim",
  "Muhammad Ridwan",
  "Nur Hidayat",
  "Oktavianus Putra",
];

const FEMALE_NAMES = [
  "Ayu Lestari",
  "Bunga Citra",
  "Dewi Anggraini",
  "Eka Wulandari",
  "Fitri Handayani",
  "Gita Permatasari",
  "Hesti Purnama",
  "Indah Sari",
  "Kartika Dewi",
  "Lina Marlina",
  "Maya Kusuma",
  "Nadia Rahmawati",
  "Oktaviani Putri",
  "Puspita Sari",
  "Ratna Juwita",
];

const CITIES = [
  "Jakarta",
  "Bandung",
  "Surabaya",
  "Semarang",
  "Yogyakarta",
  "Malang",
  "Bogor",
  "Depok",
];

async function createGroup(
  organizationId: number,
  parent: { id: number; path: string } | null,
  depth: number,
  name: string,
) {
  const group = await db.group.create({
    data: { organizationId, parentId: parent?.id ?? null, depth, name, path: "" },
  });
  const path = `${parent?.path ?? ""}${group.id}/`;
  return db.group.update({ where: { id: group.id }, data: { path } });
}

async function createUser(
  username: string,
  password: string,
  name: string,
  groupId: number,
  role: Role,
) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await db.user.create({
    data: { username, passwordHash, name, mustChangePassword: true },
  });
  await db.userGroupRole.create({ data: { userId: user.id, groupId, role } });
  return user;
}

async function main() {
  const existing = await db.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    throw new Error(
      "Seed aborted: user 'admin' already exists. Reset the database before reseeding.",
    );
  }

  const organization = await db.organization.create({
    data: { name: "Yayasan Ngaji Nusantara", timezone: "Asia/Jakarta" },
  });

  for (const [depth, name] of LEVEL_NAMES.entries()) {
    await db.level.create({ data: { organizationId: organization.id, depth, name } });
  }

  const pusat = await createGroup(organization.id, null, 0, "Pusat");

  const daerahNames = ["Daerah Jakarta", "Daerah Bandung"];
  const desaNamesByDaerah = [
    ["Desa Menteng", "Desa Kemayoran"],
    ["Desa Cicendo", "Desa Coblong"],
  ];

  const daerahGroups: Awaited<ReturnType<typeof createGroup>>[] = [];
  const kelompokGroups: Awaited<ReturnType<typeof createGroup>>[] = [];

  for (let i = 0; i < daerahNames.length; i++) {
    const daerah = await createGroup(organization.id, pusat, 1, daerahNames[i]);
    daerahGroups.push(daerah);
    for (let j = 0; j < desaNamesByDaerah[i].length; j++) {
      const desa = await createGroup(organization.id, daerah, 2, desaNamesByDaerah[i][j]);
      for (const kelompokName of ["Kelompok A", "Kelompok B"]) {
        const kelompok = await createGroup(organization.id, desa, 3, kelompokName);
        kelompokGroups.push(kelompok);
      }
    }
  }

  const owner = await createUser("admin", "admin", "Admin Pusat", pusat.id, "OWNER");
  await createUser(
    "admin_daerah",
    "admin123",
    "Admin Daerah Jakarta",
    daerahGroups[0].id,
    "ADMIN",
  );
  await createUser("user_kelompok", "user123", "Pengurus Kelompok A", kelompokGroups[0].id, "USER");

  const memberCountPerGroup = [4, 4, 4, 4, 4, 4, 3, 3]; // sums to 30, one per kelompok
  const maritalStatuses = ["BELUM_MENIKAH", "MENIKAH", "CERAI_HIDUP", "CERAI_MATI"] as const;
  const workStatuses = [
    "BEKERJA",
    "TIDAK_BEKERJA",
    "PELAJAR_SD",
    "PELAJAR_SMP",
    "PELAJAR_SMA",
    "MAHASISWA",
    "IBU_RUMAH_TANGGA",
    "PENSIUN",
  ] as const;
  const ages = [4, 10, 16, 25, 32, 40, 50, 58, 62, 70]; // spans every AGE_BRACKETS boundary
  const currentYear = new Date().getFullYear();

  let index = 0;
  for (let g = 0; g < kelompokGroups.length; g++) {
    for (let m = 0; m < memberCountPerGroup[g]; m++) {
      const isMale = index % 2 === 0;
      const name = isMale
        ? MALE_NAMES[index % MALE_NAMES.length]
        : FEMALE_NAMES[index % FEMALE_NAMES.length];
      const city = CITIES[index % CITIES.length];
      const age = ages[index % ages.length];
      const birthYear = currentYear - age;
      const birthMonth = String((index % 12) + 1).padStart(2, "0");
      const birthDay = String((index % 27) + 1).padStart(2, "0");
      // Two seeded members have already left, to exercise KELUAR statistics.
      const isKeluar = index === 5 || index === 15;

      await db.member.create({
        data: {
          groupId: kelompokGroups[g].id,
          name,
          birthPlace: city,
          birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
          sex: isMale ? "L" : "P",
          address: `Jl. Melati No. ${index + 1}, ${city}`,
          phone: `0812${String(1000000 + index).padStart(7, "0")}`,
          maritalStatus: maritalStatuses[index % maritalStatuses.length],
          workStatus: workStatuses[index % workStatuses.length],
          status: isKeluar ? "KELUAR" : "AKTIF",
          joinedAt: "2023-01-01",
          exitedAt: isKeluar ? "2024-06-01" : null,
          createdById: owner.id,
        },
      });
      index++;
    }
  }

  console.log(`Seed complete: ${index} members across ${kelompokGroups.length} kelompok groups.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
