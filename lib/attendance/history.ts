import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";

/** One page of a member's attendance rows, newest first (member-management "attendance history"). */
export async function attendanceHistoryForMember(memberId: number, page = 1, pageSize = EMBEDDED_PAGE_SIZE) {
  const where = { memberId };
  const total = await db.attendance.count({ where });
  const current = clampPage(page, total, pageSize);
  const attendances = await db.attendance.findMany({
    where,
    include: { occurrence: { include: { activity: true } } },
    orderBy: { occurrence: { date: "desc" } },
    skip: (current - 1) * pageSize,
    take: pageSize,
  });

  const entries = attendances.map((attendance) => ({
    id: attendance.id,
    status: attendance.status,
    activityName: attendance.occurrence.activity.name,
    effectiveDate: attendance.occurrence.overrideDate ?? attendance.occurrence.date,
  }));
  return { entries, total, page: current, pageSize };
}
