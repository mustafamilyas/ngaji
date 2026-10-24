import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { toActivityTemplate } from "@/lib/activity/template";
import { visibleGroupsWhere } from "@/lib/authz";
import { today } from "@/lib/dates";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveActivity } from "@/lib/resolve";
import { ancestorPathsOf, isInScope } from "@/lib/scope";
import { CheckInForm } from "./check-in-form";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseId(value: string | string[] | undefined): number | undefined {
  const id = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Standalone check-in page (no app chrome — `NavShell` skips it): pick a
 * leaf group, pick your name, done. Rights are the same as the full
 * attendance page: only users at or below the activity's group can record.
 */
export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tanggal: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, tanggal } = await params;
  const activityId = Number(id);
  if (!Number.isInteger(activityId) || !DATE_RE.test(tanggal)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let activity;
  try {
    activity = await resolveActivity(session.user, activityId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const rows = await loadOccurrenceRows(activity.id, tanggal, tanggal);
  const occurrence = occurrencesFor(toActivityTemplate(activity), tanggal, tanggal, rows).find(
    (o) => o.key === tanggal,
  );
  if (!occurrence) notFound();

  // Users above the owning group can only view (DESIGN.md §3.3) — the full page shows that read-only.
  if (!isInScope(session.user.groupPath, activity.group.path)) redirect(`/dashboard/kegiatan/${activity.id}/${tanggal}`);

  const closedReason =
    occurrence.status === "CANCELLED"
      ? "Kegiatan ini dibatalkan pada tanggal ini."
      : occurrence.effectiveDate > today(DEFAULT_TIMEZONE)
        ? "Tanggal ini belum terjadi; absensi belum bisa diisi."
        : undefined;

  const [groups, maxDepth, query, ancestors] = await Promise.all([
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, path: true, depth: true },
    }),
    getMaxDepth(activity.group.organizationId),
    searchParams,
    // Ancestry of the owning group, for the breadcrumb above the group field (names only).
    db.group.findMany({
      where: { path: { in: ancestorPathsOf(activity.group.path) } },
      orderBy: { depth: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Every leaf in the user's scope can be picked; the ones under the owning group are the defaults.
  const nameById = new Map(groups.map((g) => [g.id, g.name]));
  const leafGroups = groups
    .filter((g) => g.depth === maxDepth)
    .map((g) => ({
      id: g.id,
      name: g.name,
      parentName: g.parentId ? nameById.get(g.parentId) : undefined,
      isDefault: g.path.startsWith(activity.group.path),
    }));
  const ownerIsLeaf = activity.group.depth === maxDepth;
  // The owner is where the group field starts, so a leaf owner is the field's own value, not a crumb.
  const breadcrumb = (ownerIsLeaf ? ancestors.filter((g) => g.id !== activity.group.id) : ancestors).map((g) => g.name);

  const requestedGroup = parseId(query.grup);
  const initialGroupId =
    requestedGroup !== undefined && leafGroups.some((g) => g.id === requestedGroup)
      ? requestedGroup
      : ownerIsLeaf && leafGroups.some((g) => g.id === activity.group.id)
        ? activity.group.id
        : leafGroups.length === 1
          ? leafGroups[0].id
          : undefined;

  return (
    <CheckInForm
      activityId={activity.id}
      activityName={activity.name}
      date={occurrence.effectiveDate}
      key={tanggal}
      ruleDate={tanggal}
      startTime={occurrence.effectiveStartTime}
      closedReason={closedReason}
      leafGroups={leafGroups}
      breadcrumb={breadcrumb}
      initialGroupId={initialGroupId}
    />
  );
}
