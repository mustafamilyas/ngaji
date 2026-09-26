import { occurrencesFor, type ActivityTemplate, type OccurrenceRow } from "@/lib/activity/occurrences";
import { toActivityTemplate } from "@/lib/activity/template";
import type { SessionUser } from "@/lib/auth/session-user";
import { AGE_BRACKETS } from "@/lib/constants";
import { ageInYears, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { resolveGroup } from "@/lib/resolve";
import { ancestorPathsOf, isInScope } from "@/lib/scope";
import {
  MARITAL_STATUSES,
  SEXES,
  WORK_STATUSES,
  type MaritalStatus,
  type MemberStatus,
  type OccurrenceStatus,
  type Sex,
  type WorkStatus,
} from "@/lib/validation/enums";

/** The subset of Member needed to decide whether they were expected on a date. */
export type ExpectedMember = {
  id: number;
  deletedAt: Date | null;
  joinedAt: string;
  status: MemberStatus;
  exitedAt: string | null;
};

export type ExpectedOccurrence = {
  effectiveDate: string;
};

/**
 * Members expected at `occurrence.effectiveDate`: not soft-deleted, already
 * joined, and either still AKTIF or exited after that date. See DESIGN.md §6.
 */
export function expected<T extends ExpectedMember>(
  occurrence: ExpectedOccurrence,
  members: T[],
): T[] {
  const date = occurrence.effectiveDate;
  return members.filter((member) => {
    if (member.deletedAt !== null) return false;
    if (member.joinedAt > date) return false;
    if (member.status === "AKTIF") return true;
    return member.exitedAt !== null && member.exitedAt > date;
  });
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

/** Resolves the scope a statistic is computed for: an explicit in-scope `groupId`, or the caller's own group. */
async function resolveScopeGroup(session: SessionUser, groupId?: number) {
  return resolveGroup(session, groupId ?? session.groupId);
}

/** Every group owning an activity that can apply within, or be inherited into, `scopePath`. */
async function relatedGroupIds(scopePath: string): Promise<number[]> {
  const groups = await db.group.findMany({
    where: {
      OR: [{ path: { in: ancestorPathsOf(scopePath) } }, { path: { startsWith: scopePath } }],
    },
    select: { id: true },
  });
  return groups.map((g) => g.id);
}

export type MemberStatistics = {
  total: number;
  bySex: Record<Sex, number>;
  byMaritalStatus: Record<MaritalStatus, number>;
  byWorkStatus: Record<WorkStatus, number>;
  byAgeBracket: Record<string, number>;
  byDirectSubGroup: { groupId: number; groupName: string; count: number }[];
};

/** DESIGN.md §6 "Anggota": AKTIF, non-deleted members in scope, broken down several ways. */
export async function memberStatistics(session: SessionUser, groupId?: number): Promise<MemberStatistics> {
  const scope = await resolveScopeGroup(session, groupId);
  const members = await db.member.findMany({
    where: { status: "AKTIF", group: { path: { startsWith: scope.path } } },
  });

  const bySex = Object.fromEntries(SEXES.map((s) => [s, 0])) as Record<Sex, number>;
  const byMaritalStatus = Object.fromEntries(MARITAL_STATUSES.map((s) => [s, 0])) as Record<
    MaritalStatus,
    number
  >;
  const byWorkStatus = Object.fromEntries(WORK_STATUSES.map((s) => [s, 0])) as Record<WorkStatus, number>;
  const byAgeBracket = Object.fromEntries(AGE_BRACKETS.map((b) => [b.label, 0])) as Record<string, number>;

  const asOf = today();
  for (const member of members) {
    bySex[member.sex as Sex]++;
    byMaritalStatus[member.maritalStatus as MaritalStatus]++;
    byWorkStatus[member.workStatus as WorkStatus]++;
    const age = ageInYears(member.birthDate, asOf);
    const bracket = AGE_BRACKETS.find((b) => age >= b.min && (b.max === null || age <= b.max));
    if (bracket) byAgeBracket[bracket.label]++;
  }

  const children = await db.group.findMany({ where: { parentId: scope.id }, orderBy: { name: "asc" } });
  const byDirectSubGroup = await Promise.all(
    children.map(async (child) => ({
      groupId: child.id,
      groupName: child.name,
      count: await db.member.count({ where: { status: "AKTIF", group: { path: { startsWith: child.path } } } }),
    })),
  );

  return { total: members.length, bySex, byMaritalStatus, byWorkStatus, byAgeBracket, byDirectSubGroup };
}

export type OccurrenceStat = {
  activityId: number;
  activityName: string;
  effectiveDate: string;
  expected: number;
  hadir: number;
  izin: number;
  absent: number;
  percentHadir: number;
};

export type ActivityStatistics = {
  occurrences: OccurrenceStat[];
  trend: { date: string; percentHadir: number }[];
  byDirectSubGroup: { groupId: number; groupName: string; percentHadir: number }[];
};

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

/**
 * DESIGN.md §6 "Kegiatan": non-cancelled occurrences up to today in range,
 * `expected` computed from members within the query scope (not the
 * activity's own group — an inherited activity's stats still reflect this
 * scope's subtree, matching how attendance is recorded).
 */
export async function activityStatistics(
  session: SessionUser,
  { from, to, groupId }: { from: string; to: string; groupId?: number },
): Promise<ActivityStatistics> {
  const scope = await resolveScopeGroup(session, groupId);
  const groupIds = await relatedGroupIds(scope.path);
  const activities = await db.activity.findMany({ where: { groupId: { in: groupIds } } });

  const members = await db.member.findMany({ where: { group: { path: { startsWith: scope.path } } } });
  const membersTyped = members.map((m) => ({ ...m, status: m.status as MemberStatus }));

  const todayStr = today();
  const occurrenceStats: OccurrenceStat[] = [];

  for (const activity of activities) {
    const occurrenceRows = await db.activityOccurrence.findMany({
      where: {
        activityId: activity.id,
        OR: [{ date: { gte: from, lte: to } }, { overrideDate: { gte: from, lte: to } }],
      },
      include: { attendances: true },
    });
    const rowsByDate = new Map(occurrenceRows.map((r) => [r.date, r]));
    const rowsForExpand: OccurrenceRow[] = occurrenceRows.map((r) => ({
      date: r.date,
      status: r.status as OccurrenceStatus,
      overrideDate: r.overrideDate,
      overrideStartTime: r.overrideStartTime,
      overrideDurationMinutes: r.overrideDurationMinutes,
      overrideLocation: r.overrideLocation,
      overrideNotes: r.overrideNotes,
      hasAttendance: r.attendances.length > 0,
    }));

    const occurrences = occurrencesFor(toActivityTemplate(activity), from, to, rowsForExpand);
    for (const occurrence of occurrences) {
      if (occurrence.status === "CANCELLED") continue;
      if (occurrence.effectiveDate > todayStr) continue;

      const expectedMembers = expected({ effectiveDate: occurrence.effectiveDate }, membersTyped);
      const expectedIds = new Set(expectedMembers.map((m) => m.id));
      const attendances = rowsByDate.get(occurrence.key)?.attendances ?? [];

      let hadir = 0;
      let izin = 0;
      for (const attendance of attendances) {
        if (!expectedIds.has(attendance.memberId)) continue;
        if (attendance.status === "HADIR") hadir++;
        else if (attendance.status === "IZIN") izin++;
      }

      occurrenceStats.push({
        activityId: activity.id,
        activityName: activity.name,
        effectiveDate: occurrence.effectiveDate,
        expected: expectedMembers.length,
        hadir,
        izin,
        absent: expectedMembers.length - hadir - izin,
        percentHadir: percent(hadir, expectedMembers.length),
      });
    }
  }

  const byDate = new Map<string, { hadir: number; expected: number }>();
  for (const stat of occurrenceStats) {
    const bucket = byDate.get(stat.effectiveDate) ?? { hadir: 0, expected: 0 };
    bucket.hadir += stat.hadir;
    bucket.expected += stat.expected;
    byDate.set(stat.effectiveDate, bucket);
  }
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({ date, percentHadir: percent(bucket.hadir, bucket.expected) }));

  const children = await db.group.findMany({ where: { parentId: scope.id }, orderBy: { name: "asc" } });
  const activityGroupId = new Map(activities.map((a) => [a.id, a.groupId]));
  const groupPathById = new Map(
    (await db.group.findMany({ where: { id: { in: activities.map((a) => a.groupId) } }, select: { id: true, path: true } })).map(
      (g) => [g.id, g.path],
    ),
  );
  const byDirectSubGroup = children.map((child) => {
    let hadir = 0;
    let expectedTotal = 0;
    for (const stat of occurrenceStats) {
      const activityPath = groupPathById.get(activityGroupId.get(stat.activityId)!);
      if (activityPath && isInScope(child.path, activityPath)) {
        hadir += stat.hadir;
        expectedTotal += stat.expected;
      }
    }
    return { groupId: child.id, groupName: child.name, percentHadir: percent(hadir, expectedTotal) };
  });

  return { occurrences: occurrenceStats, trend, byDirectSubGroup };
}

export type ActivityOccurrenceAttendance = {
  key: string;
  effectiveDate: string;
  expected: number;
  hadir: number;
  izin: number;
  absent: number;
  percentHadir: number;
};

export type ActivityAttendanceSummary = {
  /** Past, non-cancelled occurrences in the range, most recent first. */
  occurrences: ActivityOccurrenceAttendance[];
  totalExpected: number;
  totalHadir: number;
  totalIzin: number;
  percentHadir: number;
};

/**
 * Attendance history for a single activity, for its own detail page
 * (DESIGN.md §6 "Kegiatan" narrowed to one activity). Expected members are
 * drawn from the activity's own group subtree — not the viewer's session
 * scope — since visibility of an inherited activity is already decided by
 * `resolveActivity`.
 */
export async function activityAttendanceSummary(
  activityId: number,
  template: ActivityTemplate,
  groupPath: string,
  { from, to }: { from: string; to: string },
): Promise<ActivityAttendanceSummary> {
  const occurrenceRows = await db.activityOccurrence.findMany({
    where: {
      activityId,
      OR: [{ date: { gte: from, lte: to } }, { overrideDate: { gte: from, lte: to } }],
    },
    include: { attendances: true },
  });
  const rowsByDate = new Map(occurrenceRows.map((r) => [r.date, r]));
  const rowsForExpand: OccurrenceRow[] = occurrenceRows.map((r) => ({
    date: r.date,
    status: r.status as OccurrenceStatus,
    overrideDate: r.overrideDate,
    overrideStartTime: r.overrideStartTime,
    overrideDurationMinutes: r.overrideDurationMinutes,
    overrideLocation: r.overrideLocation,
    overrideNotes: r.overrideNotes,
    hasAttendance: r.attendances.length > 0,
  }));

  const members = await db.member.findMany({ where: { group: { path: { startsWith: groupPath } } } });
  const membersTyped = members.map((m) => ({ ...m, status: m.status as MemberStatus }));

  const todayStr = today();
  const occurrences: ActivityOccurrenceAttendance[] = [];

  for (const occurrence of occurrencesFor(template, from, to, rowsForExpand)) {
    if (occurrence.status === "CANCELLED") continue;
    if (occurrence.effectiveDate > todayStr) continue;

    const expectedMembers = expected({ effectiveDate: occurrence.effectiveDate }, membersTyped);
    const expectedIds = new Set(expectedMembers.map((m) => m.id));
    const attendances = rowsByDate.get(occurrence.key)?.attendances ?? [];

    let hadir = 0;
    let izin = 0;
    for (const attendance of attendances) {
      if (!expectedIds.has(attendance.memberId)) continue;
      if (attendance.status === "HADIR") hadir++;
      else if (attendance.status === "IZIN") izin++;
    }

    occurrences.push({
      key: occurrence.key,
      effectiveDate: occurrence.effectiveDate,
      expected: expectedMembers.length,
      hadir,
      izin,
      absent: expectedMembers.length - hadir - izin,
      percentHadir: percent(hadir, expectedMembers.length),
    });
  }

  occurrences.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  const totalExpected = occurrences.reduce((sum, o) => sum + o.expected, 0);
  const totalHadir = occurrences.reduce((sum, o) => sum + o.hadir, 0);
  const totalIzin = occurrences.reduce((sum, o) => sum + o.izin, 0);

  return {
    occurrences,
    totalExpected,
    totalHadir,
    totalIzin,
    percentHadir: percent(totalHadir, totalExpected),
  };
}

export type RecentMember = {
  id: number;
  name: string;
  groupName: string;
  joinedAt: string;
};

/** Most recently joined AKTIF members in scope, newest first — dashboard "Anggota terbaru" widget. */
export async function recentMembers(session: SessionUser, limit: number): Promise<RecentMember[]> {
  const scope = await resolveScopeGroup(session);
  const members = await db.member.findMany({
    where: { status: "AKTIF", group: { path: { startsWith: scope.path } } },
    orderBy: { joinedAt: "desc" },
    take: limit,
    include: { group: { select: { name: true } } },
  });
  return members.map((m) => ({ id: m.id, name: m.name, groupName: m.group.name, joinedAt: m.joinedAt }));
}

/** Count of AKTIF members in scope who joined on or after `since` — dashboard stat-card hint. */
export async function newMembersCount(session: SessionUser, since: string): Promise<number> {
  const scope = await resolveScopeGroup(session);
  return db.member.count({
    where: { status: "AKTIF", joinedAt: { gte: since }, group: { path: { startsWith: scope.path } } },
  });
}

export type ParticipationRow = {
  memberId: number;
  memberName: string;
  occurrenceCount: number;
  hadir: number;
  izin: number;
  percentHadir: number;
};

/**
 * DESIGN.md §6 "Partisipasi anggota": per member, occurrences of activities
 * applying to their own group (not cancelled) within
 * `[max(from, joinedAt), min(to, exitedAt ?? today)]`.
 */
export async function participationStatistics(
  session: SessionUser,
  { from, to, groupId }: { from: string; to: string; groupId?: number },
): Promise<ParticipationRow[]> {
  const scope = await resolveScopeGroup(session, groupId);
  const groupIds = await relatedGroupIds(scope.path);
  const activities = await db.activity.findMany({
    where: { groupId: { in: groupIds } },
    include: { group: { select: { path: true } } },
  });

  type OccurrenceEntry = { effectiveDate: string; groupPath: string; attendanceByMember: Map<number, string> };
  const occurrenceEntries: OccurrenceEntry[] = [];

  for (const activity of activities) {
    const occurrenceRows = await db.activityOccurrence.findMany({
      where: {
        activityId: activity.id,
        OR: [{ date: { gte: from, lte: to } }, { overrideDate: { gte: from, lte: to } }],
      },
      include: { attendances: true },
    });
    const rowsByDate = new Map(occurrenceRows.map((r) => [r.date, r]));
    const rowsForExpand: OccurrenceRow[] = occurrenceRows.map((r) => ({
      date: r.date,
      status: r.status as OccurrenceStatus,
      overrideDate: r.overrideDate,
      overrideStartTime: r.overrideStartTime,
      overrideDurationMinutes: r.overrideDurationMinutes,
      overrideLocation: r.overrideLocation,
      overrideNotes: r.overrideNotes,
      hasAttendance: r.attendances.length > 0,
    }));

    const occurrences = occurrencesFor(toActivityTemplate(activity), from, to, rowsForExpand);
    for (const occurrence of occurrences) {
      if (occurrence.status === "CANCELLED") continue;
      const attendances = rowsByDate.get(occurrence.key)?.attendances ?? [];
      occurrenceEntries.push({
        effectiveDate: occurrence.effectiveDate,
        groupPath: activity.group.path,
        attendanceByMember: new Map(attendances.map((a) => [a.memberId, a.status])),
      });
    }
  }

  const members = await db.member.findMany({
    where: { group: { path: { startsWith: scope.path } } },
    include: { group: { select: { path: true } } },
  });

  const todayStr = today();
  return members.map((member) => {
    const windowStart = maxDate(from, member.joinedAt);
    const windowEnd = minDate(to, member.exitedAt ?? todayStr);

    let occurrenceCount = 0;
    let hadir = 0;
    let izin = 0;
    if (windowStart <= windowEnd) {
      for (const entry of occurrenceEntries) {
        if (entry.effectiveDate < windowStart || entry.effectiveDate > windowEnd) continue;
        if (!isInScope(member.group.path, entry.groupPath)) continue;
        occurrenceCount++;
        const status = entry.attendanceByMember.get(member.id);
        if (status === "HADIR") hadir++;
        else if (status === "IZIN") izin++;
      }
    }

    return {
      memberId: member.id,
      memberName: member.name,
      occurrenceCount,
      hadir,
      izin,
      percentHadir: percent(hadir, occurrenceCount),
    };
  });
}
