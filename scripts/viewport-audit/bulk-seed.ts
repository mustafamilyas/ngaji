/**
 * Extra rows for the throwaway database of `pnpm audit:viewport` and `pnpm dev:scratch`, so every server-paginated
 * table has more than one page: ~110 members in one leaf group and a daily activity with 40 past occurrences.
 * Runs after `prisma db seed` against DATABASE_URL (never prisma/dev.db: the caller always passes a scratch path).
 */
import { db } from "../../lib/db";
import { addDays, today } from "../../lib/dates";
import { DEFAULT_TIMEZONE } from "../../lib/validation/enums";
import { BULK_ACTIVITY_NAME } from "./bulk-activity";

const MEMBER_COUNT = 110;
const OCCURRENCE_COUNT = 40;

async function main() {
  const base = await db.activity.findFirstOrThrow({ where: { name: "Pengajian Rutin Kelompok A" } });
  const owner = await db.user.findFirstOrThrow({ where: { username: "admin" } });
  const template = await db.member.findFirstOrThrow({ where: { groupId: base.groupId, deletedAt: null } });
  const fields = {
    groupId: template.groupId,
    birthPlace: template.birthPlace,
    birthDate: template.birthDate,
    address: template.address,
    maritalStatus: template.maritalStatus,
    workStatus: template.workStatus,
  };

  await db.member.createMany({
    data: Array.from({ length: MEMBER_COUNT }, (_, i) => ({
      ...fields,
      name: i % 17 === 0 ? `Muhammad Abdurrahman Al-Fatih Nugraha Kusumawardhana ${i + 1}` : `Anggota Uji ${String(i + 1).padStart(3, "0")}`,
      sex: i % 2 === 0 ? "L" : "P",
      status: "AKTIF",
      exitedAt: null,
      joinedAt: "2023-01-01",
      createdById: owner.id,
    })),
  });
  const members = await db.member.findMany({ where: { groupId: base.groupId, deletedAt: null }, select: { id: true } });

  const activity = await db.activity.create({
    data: {
      groupId: base.groupId,
      name: BULK_ACTIVITY_NAME,
      location: "Aula Uji",
      startTime: "05:00",
      durationMinutes: 30,
      freq: "DAILY",
      interval: 1,
      weekdays: [],
      monthDay: null,
      startsOn: addDays(today(DEFAULT_TIMEZONE), -OCCURRENCE_COUNT),
      endsOn: null,
      createdById: owner.id,
    },
  });

  for (let day = OCCURRENCE_COUNT; day >= 1; day--) {
    const date = addDays(today(DEFAULT_TIMEZONE), -day);
    const occurrence = await db.activityOccurrence.create({ data: { activityId: activity.id, date } });
    const rows = members.flatMap((member, i) => {
      const roll = (member.id * 7 + day * 13 + i) % 10;
      if (roll >= 7) return []; // absent: no row
      return [{ occurrenceId: occurrence.id, memberId: member.id, status: roll === 6 ? "IZIN" : "HADIR", recordedById: owner.id }];
    });
    await db.attendance.createMany({ data: rows });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
