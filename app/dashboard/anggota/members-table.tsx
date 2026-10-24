import Link from "next/link";
import { CalendarCheck, Eye, Pencil } from "lucide-react";
import { SortableTh, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { RowActions } from "@/components/row-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ageInYears } from "@/lib/dates";
import { formatDate } from "@/lib/filters";
import { MEMBER_COLUMNS, type MemberColumnKey } from "@/lib/member/columns";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import { MEMBER_SORT_KEYS, type listMembers, type MemberSortKey } from "@/lib/member/queries";
import type { SortState } from "@/lib/sort";
import { cn, initials } from "@/lib/utils";
import type { Sex } from "@/lib/validation/enums";

type MemberRow = Awaited<ReturnType<typeof listMembers>>["members"][number];

function isMemberSortKey(key: string): key is MemberSortKey {
  return (MEMBER_SORT_KEYS as string[]).includes(key);
}

function cell(member: MemberRow, key: MemberColumnKey, asOf: string): React.ReactNode {
  switch (key) {
    case "grup":
      return member.group.parent ? (
        <>
          <span className="text-muted-foreground">{member.group.parent.name} › </span>
          {member.group.name}
        </>
      ) : (
        member.group.name
      );
    case "jenisKelamin":
      return SEX_LABELS[member.sex as Sex] ?? member.sex;
    case "tanggalLahir":
      return (
        <>
          {formatDate(member.birthDate)}
          <span className="text-muted-foreground"> · {ageInYears(member.birthDate, asOf)} th</span>
        </>
      );
    case "status":
      return <MemberStatusBadge status={member.status} />;
    case "whatsapp":
      return <WhatsAppButton phone={member.phone} name={member.name} compact />;
    case "hp":
      return member.phone;
    case "tempatLahir":
      return member.birthPlace;
    case "alamat":
      return (
        <span className="block max-w-64 truncate" title={member.address}>
          {member.address}
        </span>
      );
    case "statusNikah":
      return formatEnumLabel(member.maritalStatus);
    case "pekerjaan":
      return formatEnumLabel(member.workStatus);
    case "email":
      return member.email ?? <span className="text-muted-foreground">—</span>;
    case "tanggalMasuk":
      return formatDate(member.joinedAt);
  }
}

/**
 * `/dashboard/anggota` table. Server-rendered with only the viewer's chosen columns
 * (see `lib/member/columns.ts`), so hidden PII never reaches the browser.
 * Scrolls sideways on small screens with the name column pinned. Sortable
 * headers are links built by the page (`sortHrefFor`).
 */
export function MembersTable({
  members,
  columns,
  sort,
  sortHrefFor,
  today: asOf,
}: {
  members: MemberRow[];
  columns: MemberColumnKey[];
  sort: SortState<MemberSortKey>;
  sortHrefFor: (key: MemberSortKey) => string;
  /** The viewer's organization "today" (`YYYY-MM-DD`), used for ages. */
  today: string;
}) {
  const visible = MEMBER_COLUMNS.filter((c) => columns.includes(c.key));

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr className={theadRowClass}>
            <SortableTh
              label="Nama"
              href={sortHrefFor("nama")}
              dir={sort.key === "nama" ? sort.dir : undefined}
              className="sticky left-0 z-10 bg-muted"
            />
            {visible.map((column) =>
              isMemberSortKey(column.key) ? (
                <SortableTh
                  key={column.key}
                  label={column.label}
                  href={sortHrefFor(column.key)}
                  dir={sort.key === column.key ? sort.dir : undefined}
                />
              ) : (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(thClass, column.key === "whatsapp" && "text-center")}
                >
                  {column.key === "whatsapp" ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ),
            )}
            <th scope="col" className={cn(thClass, "w-12")}>
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className={trClass}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium group-hover/row:bg-muted"
              >
                <Link href={`/dashboard/anggota/${member.id}`} className="flex items-center gap-2.5 whitespace-nowrap hover:underline">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  {member.name}
                </Link>
              </th>
              {visible.map((column) => (
                <td key={column.key} className={cn(tdClass, column.key === "whatsapp" && "py-1 text-center")}>
                  {cell(member, column.key, asOf)}
                </td>
              ))}
              <td className="px-2 py-1 text-right">
                <RowActions
                  label={member.name}
                  actions={[
                    { label: "Lihat profil", href: `/dashboard/anggota/${member.id}`, icon: <Eye /> },
                    { label: "Riwayat kehadiran", href: `/dashboard/anggota/${member.id}?tab=kehadiran`, icon: <CalendarCheck /> },
                    { label: "Ubah data", href: `/dashboard/anggota/${member.id}?tab=ubah`, icon: <Pencil /> },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
