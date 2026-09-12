import { db } from "@/lib/db";

/** Most recent attendance rows for one member, newest first (member-management "attendance history"). */
export async function attendanceHistoryForMember(memberId: number, limit = 20) {
  const attendances = await db.attendance.findMany({
    where: { memberId },
    include: { occurrence: { include: { activity: true } } },
    orderBy: { occurrence: { date: "desc" } },
    take: limit,
  });

  return attendances.map((attendance) => ({
    id: attendance.id,
    status: attendance.status,
    activityName: attendance.occurrence.activity.name,
    effectiveDate: attendance.occurrence.overrideDate ?? attendance.occurrence.date,
  }));
}
