/**
 * Extra rows for the throwaway database of `pnpm audit:viewport` and `pnpm dev:scratch`, so every server-paginated
 * table has more than one page: ~110 members in one leaf group and a daily activity with 40 past occurrences.
 * Runs after `prisma db seed` against DATABASE_URL (never prisma/dev.db: the caller always passes a scratch path).
 */
import { db } from "../../lib/db";
import { addDays, today } from "../../lib/dates";
import { DEFAULT_TIMEZONE } from "../../lib/validation/enums";
import type { Prisma } from "../../lib/generated/prisma/client";
import { definitionSchema, newViewDefinition } from "../../lib/validation/member-view";
import { BULK_ACTIVITY_NAME, BULK_VIEW_NAME } from "./bulk-activity";

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

  const root = await db.group.findFirstOrThrow({ where: { depth: 0, deletedAt: null }, orderBy: { id: "asc" } });
  await seedSummaryView({ id: owner.id, groupId: root.id });
}

/** A saved view with every kind of summary card, one of them with more buckets than a page (`EMBEDDED_PAGE_SIZE`). */
async function seedSummaryView(owner: { id: number; groupId: number }) {
  const tag = await db.tag.findFirst({ where: { key: "prioritas", value: null, deletedAt: null } });
  const tagKey = await db.tag.findFirst({ where: { key: "prioritas", value: { not: null }, deletedAt: null } });
  const manyAgeBuckets = Array.from({ length: 12 }, (_, i) =>
    i === 11 ? { label: "55+", min: 55, max: null } : { label: `${i * 5}–${i * 5 + 4} tahun`, min: i * 5, max: i * 5 + 4 },
  );
  const definition = definitionSchema.parse({
    ...newViewDefinition(),
    summaries: [
      { dimension: { kind: "property", field: "sex" } },
      { dimension: { kind: "ageBuckets", buckets: manyAgeBuckets } },
      { dimension: { kind: "groupLevel", depth: 3 } },
      ...(tagKey ? [{ dimension: { kind: "tagKey", tagId: tagKey.id } }] : []),
      ...(tag ? [{ dimension: { kind: "tag", tagId: tag.id } }] : []),
    ],
  });
  await db.memberView.create({
    data: {
      groupId: owner.groupId,
      ownerId: owner.id,
      createdById: owner.id,
      name: BULK_VIEW_NAME,
      definition: definition as unknown as Prisma.InputJsonValue,
    },
  });
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
