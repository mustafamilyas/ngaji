import Link from "next/link";
import { CalendarCheck, Eye, Pencil } from "lucide-react";
import { SortableTh, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { RowActions } from "@/components/row-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RowTags } from "@/components/tags/row-tags";
import { RowCheckbox, SelectAllRow } from "@/components/tags/bulk-selection";
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

function cell(member: MemberRow, key: MemberColumnKey, asOf: string, canPick: boolean): React.ReactNode {
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
    case "tag":
      return (
        <RowTags
          target={{ kind: "member", id: member.id }}
          attached={member.tags.map((link) => link.tag)}
          canPick={canPick}
          label={member.name}
        />
      );
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
 * From `md` it is a table that scrolls sideways with the name column pinned;
 * below `md` the same markup is laid out as one card per member (name + row
 * menu, then each chosen column as a labelled line), so a phone never scrolls
 * sideways. Sortable headers are links built by the page (`sortHrefFor`);
 * they are table-only.
 */
export function MembersTable({
  members,
  columns,
  sort,
  sortHrefFor,
  today: asOf,
  canPickRowTags,
  selectable,
}: {
  members: MemberRow[];
  columns: MemberColumnKey[];
  sort: SortState<MemberSortKey>;
  sortHrefFor: (key: MemberSortKey) => string;
  /** The viewer's organization "today" (`YYYY-MM-DD`), used for ages. */
  today: string;
  /** The Tag column gets a picker per row (the page provides `TagOptionsProvider`); otherwise chips only. */
  canPickRowTags: boolean;
  /** Row checkboxes and "pilih semua" for bulk tagging (the page provides `BulkSelectionProvider`). */
  selectable: boolean;
}) {
  const visible = MEMBER_COLUMNS.filter((c) => columns.includes(c.key));
  const canPick = canPickRowTags;

  // `relative` keeps the absolutely positioned sr-only header labels inside the scroller; without it they widen the whole page.
  const table = (
    <div className="relative overflow-x-auto">
      <table className={cn(tableClass, "block md:table")}>
        <thead className="hidden md:table-header-group">
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
        <tbody className="block md:table-row-group">
          {members.map((member) => (
            <tr
              key={member.id}
              className={cn(trClass, "grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 px-4 py-2 md:table-row md:p-0")}
            >
              <th
                scope="row"
                className="block bg-transparent p-0 text-left font-medium md:table-cell md:sticky md:left-0 md:z-10 md:bg-card md:px-4 md:py-2.5 md:group-hover/row:bg-muted"
              >
                <div className="flex items-center gap-1">
                  {selectable && <RowCheckbox memberId={member.id} name={member.name} />}
                  <Link
                    href={`/dashboard/anggota/${member.id}`}
                    className="flex min-h-11 items-center gap-2.5 hover:underline md:whitespace-nowrap xl:min-h-0"
                  >
                    <Avatar size="sm">
                      <AvatarFallback>{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    {member.name}
                  </Link>
                </div>
              </th>
              {visible.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    tdClass,
                    "flex items-center justify-between gap-3 px-0 py-0 text-sm whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap",
                    column.key === "whatsapp" ? "col-start-2 row-start-1" : "col-span-3",
                    column.key === "whatsapp" && "md:py-1 md:text-center",
                    column.key === "tag" && "md:min-w-72 md:whitespace-normal",
                  )}
                >
                  {column.key !== "whatsapp" && (
                    <span className="shrink-0 text-xs text-muted-foreground md:hidden">{column.label}</span>
                  )}
                  <span className="min-w-0 text-right md:[text-align:inherit]">{cell(member, column.key, asOf, canPick)}</span>
                </td>
              ))}
              <td className="col-start-3 row-start-1 p-0 text-right md:px-2 md:py-1">
                <RowActions
                  className="size-11 xl:size-8"
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

  return (
    <>
      {selectable && <SelectAllRow />}
      {table}
    </>
  );
}
