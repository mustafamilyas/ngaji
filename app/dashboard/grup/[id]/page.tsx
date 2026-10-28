import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, ChevronRight, Network, Settings, UserCog, UserPlus, Users } from "lucide-react";
import { auth } from "@/auth";
import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { TabNav, type TabItem } from "@/components/tab-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scheduleLabel } from "@/lib/activity/labels";
import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parsePage } from "@/lib/filters";
import { getLevels } from "@/lib/group/levels";
import { groupTrail } from "@/lib/group/trail";
import { clampPage, pageHref, paginate } from "@/lib/pagination";
import { resolveGroup } from "@/lib/resolve";
import { parseTab } from "@/lib/tabs";

import { initials } from "@/lib/utils";
import { AddSubgroupDialog } from "./add-subgroup-dialog";
import { DeleteGroupForm } from "./delete-group-form";
import { RenameGroupForm } from "./rename-group-form";

const TABS = ["subgrup", "anggota", "kegiatan", "pengguna", "pengaturan"] as const;
type Tab = (typeof TABS)[number];

const rowClass = "-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted";

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const groupId = Number(id);
  if (!Number.isInteger(groupId)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let group;
  try {
    group = await resolveGroup(session.user, groupId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const memberTotal = await db.member.count({ where: { groupId: group.id } });
  const memberPage = clampPage(parsePage(query.anggota), memberTotal, EMBEDDED_PAGE_SIZE);

  const [allChildren, members, allActivities, allUserRoles, levels, trail] = await Promise.all([
    db.group.findMany({ where: { parentId: group.id }, orderBy: { name: "asc" } }),
    db.member.findMany({
      where: { groupId: group.id },
      orderBy: { name: "asc" },
      skip: (memberPage - 1) * EMBEDDED_PAGE_SIZE,
      take: EMBEDDED_PAGE_SIZE,
    }),
    db.activity.findMany({ where: { groupId: group.id }, orderBy: { name: "asc" } }),
    db.userGroupRole.findMany({
      where: { groupId: group.id },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    getLevels(group.organizationId),
    groupTrail(session.user.groupPath, group.path),
  ]);

  const children = paginate(allChildren, parsePage(query.subgrup), EMBEDDED_PAGE_SIZE);
  const activities = paginate(allActivities, parsePage(query.kegiatan), EMBEDDED_PAGE_SIZE);
  const userRoles = paginate(allUserRoles, parsePage(query.pengguna), EMBEDDED_PAGE_SIZE);
  const path = `/dashboard/grup/${group.id}`;

  const canEdit = session.user.role === "ADMIN" || session.user.role === "OWNER";
  const maxDepth = levels.length > 0 ? levels[levels.length - 1].depth : 0;
  const isLeaf = group.depth === maxDepth;
  const levelName = levels[group.depth]?.name ?? "";
  const childLevelName = levels[group.depth + 1]?.name ?? "";

  // Only leaves hold members and only non-leaves hold sub-groups, so each group shows one of the two.
  const tabs: TabItem<Tab>[] = [
    isLeaf
      ? { key: "anggota", label: "Anggota", icon: Users, count: memberTotal }
      : { key: "subgrup", label: childLevelName || "Sub-grup", icon: Network, count: children.total },
    { key: "kegiatan", label: "Kegiatan", icon: CalendarDays, count: activities.total },
    { key: "pengguna", label: "Pengguna", icon: UserCog, count: userRoles.total },
    ...(canEdit ? [{ key: "pengaturan" as const, label: "Pengaturan", icon: Settings }] : []),
  ];
  const defaultTab: Tab = isLeaf ? "anggota" : "subgrup";
  const requested = parseTab(query.tab, TABS, defaultTab);
  const tab = tabs.some((t) => t.key === requested) ? requested : defaultTab;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Grup", href: "/dashboard/grup" },
          ...trail.map((g) => ({ label: g.name, href: g.href })),
        ]}
        title={group.name}
        badges={levelName && <Badge variant="secondary">{levelName}</Badge>}
        actions={
          <>
            <Link href={`/dashboard/anggota?grup=${group.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Users />
              Lihat semua anggota
            </Link>
            {isLeaf ? (
              <Link href={`/dashboard/anggota/baru?grup=${group.id}`} className={buttonVariants({ size: "lg" })}>
                <UserPlus />
                Tambah anggota
              </Link>
            ) : (
              canEdit && (
                <AddSubgroupDialog parentId={group.id} parentName={group.name} childLevelName={childLevelName} />
              )
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <TabNav path={path} tabs={tabs} current={tab} defaultTab={defaultTab} />

        {tab === "subgrup" && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              {children.total > 0 ? (
                <ul className="flex flex-col divide-y">
                  {children.items.map((child) => (
                    <li key={child.id}>
                      <Link href={`/dashboard/grup/${child.id}`} className={rowClass}>
                        <span className="truncate text-sm font-medium">{child.name}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyRow>Belum ada {(childLevelName || "sub-grup").toLowerCase()}.</EmptyRow>
              )}
              <Pagination
                {...children}
                scroll={false}
                hrefFor={(target) => pageHref(path, query, target, "subgrup")}
              />
            </CardContent>
          </Card>
        )}

        {tab === "anggota" && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              {members.length > 0 ? (
                <ul className="flex flex-col divide-y">
                  {members.map((member) => (
                    <li key={member.id}>
                      <Link href={`/dashboard/anggota/${member.id}`} className={rowClass}>
                        <span className="truncate text-sm font-medium">{member.name}</span>
                        <MemberStatusBadge status={member.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyRow>Belum ada anggota.</EmptyRow>
              )}
              <Pagination
                page={memberPage}
                pageSize={EMBEDDED_PAGE_SIZE}
                total={memberTotal}
                scroll={false}
                hrefFor={(target) => pageHref(path, query, target, "anggota")}
              />
            </CardContent>
          </Card>
        )}

        {tab === "kegiatan" && (
          <Card>
            <CardHeader>
              <CardDescription>
                Kegiatan milik {group.name}; berlaku juga untuk semua grup di bawahnya.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {activities.total > 0 ? (
                <ul className="flex flex-col divide-y">
                  {activities.items.map((activity) => (
                    <li key={activity.id}>
                      <Link href={`/dashboard/kegiatan/${activity.id}`} className={rowClass}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{activity.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {scheduleLabel(activity)} · {activity.startTime} · {activity.location}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyRow>Belum ada kegiatan.</EmptyRow>
              )}
              <Pagination
                {...activities}
                scroll={false}
                hrefFor={(target) => pageHref(path, query, target, "kegiatan")}
              />
            </CardContent>
          </Card>
        )}

        {tab === "pengguna" && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              {userRoles.total > 0 ? (
                <ul className="flex flex-col divide-y">
                  {userRoles.items.map((userRole) => (
                    <li key={userRole.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback>{initials(userRole.user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">{userRole.user.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!userRole.user.isActive && <Badge variant="outline">Nonaktif</Badge>}
                        <Badge variant="secondary">{userRole.role}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyRow>Belum ada pengguna.</EmptyRow>
              )}
              <Pagination
                {...userRoles}
                scroll={false}
                hrefFor={(target) => pageHref(path, query, target, "pengguna")}
              />
            </CardContent>
          </Card>
        )}

        {tab === "pengaturan" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Nama grup</CardTitle>
              </CardHeader>
              <CardContent>
                <RenameGroupForm groupId={group.id} name={group.name} />
              </CardContent>
            </Card>

            <DangerZone>
              <DangerZoneItem
                title="Hapus grup"
                description="Hanya bisa jika grup kosong: tanpa sub-grup, anggota, kegiatan, dan pengguna."
              >
                <DeleteGroupForm groupId={group.id} />
              </DangerZoneItem>
            </DangerZone>
          </>
        )}
      </div>
    </div>
  );
}
