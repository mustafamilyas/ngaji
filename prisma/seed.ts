import bcrypt from "bcrypt";
import { db } from "../lib/db";
import { BCRYPT_COST } from "../lib/constants";
import { expandDates } from "../lib/activity/expand";
import { addDays, daysBetween, today } from "../lib/dates";
import type { AttendanceStatus, MemberStatus, Role } from "../lib/validation/enums";

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

type GroupRef = { id: number; path: string };

async function createGroup(
  organizationId: number,
  parent: GroupRef | null,
  depth: number,
  name: string,
): Promise<GroupRef> {
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
  isActive = true,
) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await db.user.create({
    data: { username, passwordHash, name, isActive, mustChangePassword: true },
  });
  await db.userGroupRole.create({ data: { userId: user.id, groupId, role } });
  return user;
}

/** Mirrors `expected()` in lib/stats.ts, for members already known to be `deletedAt: null`. */
function isExpectedOn(
  member: { joinedAt: string; status: string; exitedAt: string | null },
  date: string,
): boolean {
  if (member.joinedAt > date) return false;
  if (member.status === "AKTIF") return true;
  return member.exitedAt !== null && member.exitedAt > date;
}

/** Deterministic HADIR/IZIN/absent split so re-running the seed from empty produces the same history. */
function attendanceStatusFor(memberId: number, dateOrdinal: number): AttendanceStatus | null {
  const bucket = (memberId * 7 + dateOrdinal * 3) % 10;
  if (bucket < 7) return "HADIR"; // 70%
  if (bucket < 9) return "IZIN"; // 20%
  return null; // 10% absent (no row)
}

/**
 * Creates one `ActivityOccurrence` per rule date in `dates` and records
 * attendance for every member expected on its effective date. `special`
 * lets a handful of dates carry a cancel / override / move-once edge case,
 * matching DESIGN.md §5.5.
 */
async function seedHistory(
  activityId: number,
  dates: string[],
  members: { id: number; joinedAt: string; status: string; exitedAt: string | null }[],
  recordedById: number,
  special: {
    cancelDate?: string;
    overrideDate?: string;
    moveDate?: string;
  } = {},
) {
  for (const date of dates) {
    if (date === special.cancelDate) {
      await db.activityOccurrence.create({
        data: { activityId, date, status: "CANCELLED", overrideNotes: "Diliburkan karena hari libur nasional" },
      });
      continue;
    }

    const overrides: Record<string, unknown> = {};
    let effectiveDate = date;

    if (date === special.overrideDate) {
      overrides.overrideStartTime = "20:00";
      overrides.overrideDurationMinutes = 60;
      overrides.overrideLocation = "Masjid Al-Ikhlas (pindah sementara karena hujan)";
    }
    if (date === special.moveDate) {
      effectiveDate = addDays(date, 2);
      overrides.overrideDate = effectiveDate;
    }

    const occurrence = await db.activityOccurrence.create({ data: { activityId, date, ...overrides } });

    for (const member of members) {
      if (!isExpectedOn(member, effectiveDate)) continue;
      const status = attendanceStatusFor(member.id, daysBetween("2020-01-01", effectiveDate));
      if (status === null) continue;
      await db.attendance.create({
        data: { occurrenceId: occurrence.id, memberId: member.id, status, recordedById },
      });
    }
  }
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

  const daerahJakarta = await createGroup(organization.id, pusat, 1, "Daerah Jakarta");
  const desaMenteng = await createGroup(organization.id, daerahJakarta, 2, "Desa Menteng");
  const kelompokA_Menteng = await createGroup(organization.id, desaMenteng, 3, "Kelompok A");
  const kelompokB_Menteng = await createGroup(organization.id, desaMenteng, 3, "Kelompok B");
  const desaKemayoran = await createGroup(organization.id, daerahJakarta, 2, "Desa Kemayoran");
  const kelompokA_Kemayoran = await createGroup(organization.id, desaKemayoran, 3, "Kelompok A");
  const kelompokB_Kemayoran = await createGroup(organization.id, desaKemayoran, 3, "Kelompok B");

  const daerahBandung = await createGroup(organization.id, pusat, 1, "Daerah Bandung");
  const desaCicendo = await createGroup(organization.id, daerahBandung, 2, "Desa Cicendo");
  const kelompokA_Cicendo = await createGroup(organization.id, desaCicendo, 3, "Kelompok A");
  const kelompokB_Cicendo = await createGroup(organization.id, desaCicendo, 3, "Kelompok B");
  const desaCoblong = await createGroup(organization.id, daerahBandung, 2, "Desa Coblong");
  const kelompokA_Coblong = await createGroup(organization.id, desaCoblong, 3, "Kelompok A");
  const kelompokB_Coblong = await createGroup(organization.id, desaCoblong, 3, "Kelompok B");

  const kelompokGroups = [
    kelompokA_Menteng,
    kelompokB_Menteng,
    kelompokA_Kemayoran,
    kelompokB_Kemayoran,
    kelompokA_Cicendo,
    kelompokB_Cicendo,
    kelompokA_Coblong,
    kelompokB_Coblong,
  ];

  const owner = await createUser("admin", "admin", "Admin Pusat", pusat.id, "OWNER");
  await createUser("admin_daerah", "admin123", "Admin Daerah Jakarta", daerahJakarta.id, "ADMIN");
  const userKelompok = await createUser(
    "user_kelompok",
    "user123",
    "Pengurus Kelompok A",
    kelompokA_Menteng.id,
    "USER",
  );
  // Edge case: a deactivated account (isActive = false) — must be rejected at login
  // and re-validated out mid-session (DESIGN.md §4.1/§4.4/`jwt` callback).
  await createUser(
    "user_nonaktif",
    "nonaktif123",
    "Pengurus Kelompok B (Nonaktif)",
    kelompokB_Menteng.id,
    "USER",
    false,
  );

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

  // A handful of members exercise every non-AKTIF MemberStatus and the
  // exitedAt / statistics boundary it implies (DESIGN.md §6, §9 non-MVP note).
  function specialStatus(index: number): { status: MemberStatus; exitedAt: string | null } {
    if (index === 5) return { status: "MENINGGAL", exitedAt: "2024-06-01" };
    if (index === 15) return { status: "PINDAH", exitedAt: "2024-06-01" };
    if (index === 20) return { status: "KELUAR", exitedAt: "2025-03-01" };
    return { status: "AKTIF", exitedAt: null };
  }

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
      const { status, exitedAt } = specialStatus(index);
      // Roughly a third of members have an email on file; most small
      // congregations only track phone numbers, so this stays a minority.
      const email =
        index % 3 === 0 ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@contoh.id` : undefined;

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
          ...(email ? { email } : {}),
          status,
          joinedAt: "2023-01-01",
          exitedAt,
          createdById: owner.id,
        },
      });
      index++;
    }
  }

  // Edge case: a member who joined only 20 days ago — excluded from `expected()`
  // on every older historical occurrence, included on recent ones.
  const mentengMembers = await db.member.findMany({
    where: { groupId: kelompokA_Menteng.id },
    orderBy: { id: "asc" },
  });
  const recentJoiner = mentengMembers[mentengMembers.length - 1];
  await db.member.update({
    where: { id: recentJoiner.id },
    data: { joinedAt: addDays(today(), -20) },
  });

  // Edge case: a member who left only 14 days ago — still `expected()` (and
  // has recorded attendance) on most of the historical range below, but not
  // on the most recent occurrences.
  const recentLeaver = await db.member.create({
    data: {
      groupId: kelompokA_Menteng.id,
      name: "Siti Rahayu",
      birthPlace: "Jakarta",
      birthDate: "1990-04-12",
      sex: "P",
      address: "Jl. Melati No. 31, Jakarta",
      phone: "0812100000031",
      maritalStatus: "MENIKAH",
      workStatus: "IBU_RUMAH_TANGGA",
      status: "KELUAR",
      joinedAt: "2023-01-01",
      exitedAt: addDays(today(), -14),
      createdById: owner.id,
    },
  });

  // Edge case: a soft-deleted member (data-entry mistake, distinct from KELUAR)
  // — must vanish from every list/count via the `lib/db.ts` extension.
  const kemayoranMembers = await db.member.findMany({
    where: { groupId: kelompokA_Kemayoran.id },
    orderBy: { id: "asc" },
  });
  await db.member.update({
    where: { id: kemayoranMembers[0].id },
    data: { deletedAt: new Date() },
  });

  // --- Activities ------------------------------------------------------

  // A) Main recurring activity: weekly, owned by a leaf group, long history.
  const activityA = await db.activity.create({
    data: {
      groupId: kelompokA_Menteng.id,
      name: "Pengajian Rutin Kelompok A",
      location: "Rumah Bpk. Ahmad, Menteng",
      notes: "Pengajian mingguan bapak-bapak & ibu-ibu",
      startTime: "19:30",
      durationMinutes: 90,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [4], // Thursday
      monthDay: null,
      startsOn: "2023-01-05",
      endsOn: null,
      createdById: owner.id,
    },
  });

  // B) Conflicted activity: weekly, owned by an ancestor group (Daerah
  // Jakarta), inherited into Kelompok A/Menteng, overlapping A's time window
  // every Thursday — DESIGN.md §5.4 conflict detection, warning-only.
  await db.activity.create({
    data: {
      groupId: daerahJakarta.id,
      name: "Kajian Akbar Daerah Jakarta",
      location: "Aula Kantor Daerah Jakarta",
      notes: "Kajian gabungan seluruh desa & kelompok se-Daerah Jakarta",
      startTime: "19:00",
      durationMinutes: 120,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [4], // Thursday — overlaps activity A's 19:30-21:00 window
      monthDay: null,
      startsOn: "2023-01-05",
      endsOn: null,
      createdById: owner.id,
    },
  });

  // C) Monthly activity anchored on day 31 — edge case for `expandDates`
  // (Feb/Apr/Jun/Sep/Nov silently skipped), owned by the root group so
  // `expected()` spans every member in the organization.
  const activityC = await db.activity.create({
    data: {
      groupId: pusat.id,
      name: "Rapat Koordinasi Nasional",
      location: "Kantor Pusat",
      notes: "Rapat koordinasi pengurus seluruh jenjang, akhir bulan (bila tanggal 31 ada)",
      startTime: "09:00",
      durationMinutes: 180,
      freq: "MONTHLY",
      interval: 1,
      weekdays: [],
      monthDay: 31,
      startsOn: "2023-01-31",
      endsOn: null,
      createdById: owner.id,
    },
  });

  // D) Already-ended activity — DESIGN.md §5.5 "Akhiri mulai tanggal X".
  const activityD = await db.activity.create({
    data: {
      groupId: kelompokA_Cicendo.id,
      name: "Tahsin Mingguan",
      location: "Musala Kelompok A, Cicendo",
      notes: "Kelas tahsin Al-Qur'an — dihentikan pertengahan 2025",
      startTime: "16:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1], // Monday
      monthDay: null,
      startsOn: "2023-02-06",
      endsOn: "2025-06-30",
      createdById: owner.id,
    },
  });

  // E) Split lineage — DESIGN.md §5.5 "Geser ini & seterusnya" / `activity.split`.
  const tpaOriginal = await db.activity.create({
    data: {
      groupId: kelompokB_Menteng.id,
      name: "TPA Sore",
      location: "Musala Kelompok B, Menteng",
      notes: "Taman Pendidikan Al-Qur'an sore hari",
      startTime: "16:00",
      durationMinutes: 90,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1, 3], // Monday & Wednesday
      monthDay: null,
      startsOn: "2023-01-02",
      endsOn: "2024-12-31",
      createdById: owner.id,
    },
  });
  const tpaContinuation = await db.activity.create({
    data: {
      groupId: kelompokB_Menteng.id,
      name: "TPA Sore",
      location: "Musala Baru Kelompok B, Menteng",
      notes: "Pindah lokasi & jam mulai 2025",
      startTime: "16:30",
      durationMinutes: 90,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1, 3],
      monthDay: null,
      startsOn: "2025-01-01",
      endsOn: null,
      continuesFromId: tpaOriginal.id,
      createdById: owner.id,
    },
  });

  // F) One-time upcoming activity, inherited from a desa group into both its
  // kelompok — shows up in the dashboard's "7 hari ke depan" widget.
  await db.activity.create({
    data: {
      groupId: desaCoblong.id,
      name: "Santunan Yatim & Dhuafa",
      location: "Balai Desa Coblong",
      notes: "Kegiatan tahunan, berlaku untuk seluruh kelompok di Desa Coblong",
      startTime: "08:00",
      durationMinutes: 240,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      monthDay: null,
      startsOn: addDays(today(), 4),
      endsOn: addDays(today(), 4),
      createdById: owner.id,
    },
  });

  // G) Soft-deleted activity — must be hidden from every list/query.
  const trialActivity = await db.activity.create({
    data: {
      groupId: kelompokB_Kemayoran.id,
      name: "Kegiatan Uji Coba (Dihapus)",
      location: "Belum ditentukan",
      startTime: "20:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [5],
      monthDay: null,
      startsOn: "2024-01-05",
      endsOn: null,
      createdById: owner.id,
    },
  });
  await db.activity.update({ where: { id: trialActivity.id }, data: { deletedAt: new Date() } });

  // --- Historical occurrences & attendance ------------------------------

  const historyFrom = addDays(today(), -63);
  const historyTo = addDays(today(), -1);
  const historyDatesA = expandDates(
    { freq: "WEEKLY", interval: 1, weekdays: [4], monthDay: null, startsOn: "2023-01-05", endsOn: null },
    historyFrom,
    historyTo,
  );
  const cancelDate = historyDatesA[historyDatesA.length - 2];
  const overrideDate = historyDatesA[historyDatesA.length - 4];
  const moveDate = historyDatesA[historyDatesA.length - 6];

  const activityAMembers = [...mentengMembers.slice(0, -1), recentJoiner, recentLeaver].map((m) => ({
    id: m.id,
    joinedAt: m.id === recentJoiner.id ? addDays(today(), -20) : m.joinedAt,
    status: m.id === recentLeaver.id ? "KELUAR" : m.status,
    exitedAt: m.id === recentLeaver.id ? addDays(today(), -14) : m.exitedAt,
  }));

  await seedHistory(activityA.id, historyDatesA, activityAMembers, userKelompok.id, {
    cancelDate,
    overrideDate,
    moveDate,
  });

  // C) One past national coordination meeting: only a handful of
  // representatives (one per Kelompok A) actually attend — a realistic low
  // turnout against an org-wide `expected()` denominator.
  const monthlyDatesC = expandDates(
    { freq: "MONTHLY", interval: 1, weekdays: [], monthDay: 31, startsOn: "2023-01-31", endsOn: null },
    addDays(today(), -360),
    addDays(today(), -30),
  );
  const pastMonthlyDate = monthlyDatesC[monthlyDatesC.length - 1];
  if (pastMonthlyDate) {
    const occurrenceC = await db.activityOccurrence.create({
      data: { activityId: activityC.id, date: pastMonthlyDate },
    });
    const representativeGroups = [kelompokA_Menteng, kelompokA_Kemayoran, kelompokA_Cicendo, kelompokA_Coblong];
    // `findFirst` (unlike `findFirstOrThrow`) goes through `lib/db.ts`'s
    // soft-delete extension, so Kelompok A/Kemayoran's soft-deleted member
    // above is skipped automatically.
    const representatives = await Promise.all(
      representativeGroups.map((group) => db.member.findFirst({ where: { groupId: group.id }, orderBy: { id: "asc" } })),
    );
    for (const [i, rep] of representatives.entries()) {
      if (!rep) continue;
      await db.attendance.create({
        data: { occurrenceId: occurrenceC.id, memberId: rep.id, status: i === 0 ? "IZIN" : "HADIR", recordedById: owner.id },
      });
    }
  }

  // D) Last two occurrences before Tahsin Mingguan was ended.
  const datesD = expandDates(
    { freq: "WEEKLY", interval: 1, weekdays: [1], monthDay: null, startsOn: "2023-02-06", endsOn: "2025-06-30" },
    "2025-06-01",
    "2025-06-30",
  ).slice(-2);
  const cicendoMembers = await db.member.findMany({ where: { groupId: kelompokA_Cicendo.id } });
  await seedHistory(activityD.id, datesD, cicendoMembers, owner.id);

  // E) A couple of occurrences on each side of the TPA Sore split.
  const kelompokBMentengMembers = await db.member.findMany({ where: { groupId: kelompokB_Menteng.id } });
  const datesBeforeSplit = expandDates(
    { freq: "WEEKLY", interval: 1, weekdays: [1, 3], monthDay: null, startsOn: "2023-01-02", endsOn: "2024-12-31" },
    "2024-11-01",
    "2024-12-31",
  ).slice(-2);
  const datesAfterSplit = expandDates(
    { freq: "WEEKLY", interval: 1, weekdays: [1, 3], monthDay: null, startsOn: "2025-01-01", endsOn: null },
    "2025-01-01",
    "2025-02-28",
  ).slice(0, 2);
  await seedHistory(tpaOriginal.id, datesBeforeSplit, kelompokBMentengMembers, owner.id);
  await seedHistory(tpaContinuation.id, datesAfterSplit, kelompokBMentengMembers, owner.id);

  console.log(
    `Seed complete: ${index + 2} members, ${kelompokGroups.length} kelompok groups, 7 activities (1 conflicted, 1 monthly-edge, 1 ended, 1 split, 1 upcoming, 1 soft-deleted), historical attendance over ${historyDatesA.length} weeks.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
