import Link from "next/link";
import { tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RowTags } from "@/components/tags/row-tags";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ageInYears } from "@/lib/dates";
import { formatDate } from "@/lib/filters";
import { MEMBER_COLUMNS, type MemberColumnKey } from "@/lib/member/columns";
import type { TagSummary } from "@/lib/tag/include";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import { cn, initials } from "@/lib/utils";
import type { Sex } from "@/lib/validation/enums";

/**
 * A result row holds only the fields of the view's chosen columns
 * (`memberSelectFor`), so every field besides `id` and `name` may be absent.
 */
export type ViewMemberRow = {
  id: number;
  name: string;
  group?: { id: number; name: string; parent: { name: string } | null };
  sex?: string;
  birthDate?: string;
  status?: string;
  code?: string | null;
  phone?: string;
  birthPlace?: string;
  address?: string;
  maritalStatus?: string;
  workStatus?: string;
  email?: string | null;
  joinedAt?: string;
  tags?: { tag: TagSummary }[];
};

function cell(member: ViewMemberRow, key: MemberColumnKey, asOf: string): React.ReactNode {
  switch (key) {
    case "grup":
      if (!member.group) return null;
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
      return member.birthDate ? (
        <>
          {formatDate(member.birthDate)}
          <span className="text-muted-foreground"> · {ageInYears(member.birthDate, asOf)} th</span>
        </>
      ) : null;
    case "status":
      return member.status ? <MemberStatusBadge status={member.status as never} /> : null;
    case "tag":
      // Views are read-only lists: chips without a picker.
      return <RowTags target={{ kind: "member", id: member.id }} attached={(member.tags ?? []).map((link) => link.tag)} canPick={false} label={member.name} />;
    case "whatsapp":
      return <WhatsAppButton phone={member.phone ?? ""} name={member.name} compact />;
    case "kode":
      return member.code ? <span className="font-mono">{member.code}</span> : <span className="text-muted-foreground">—</span>;
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
      return member.maritalStatus ? formatEnumLabel(member.maritalStatus) : null;
    case "pekerjaan":
      return member.workStatus ? formatEnumLabel(member.workStatus) : null;
    case "email":
      return member.email ?? <span className="text-muted-foreground">—</span>;
    case "tanggalMasuk":
      return member.joinedAt ? formatDate(member.joinedAt) : null;
  }
}

/**
 * Result table of a member view: the name column plus the definition's columns
 * only. Rendered in server pages and, for loaded-on-demand section rows, in the
 * client (`view-sections.tsx`) — `asOf` is passed in so both agree on "today".
 */
export function ViewMembersTable({
  members,
  columns,
  asOf,
}: {
  members: ViewMemberRow[];
  columns: readonly MemberColumnKey[];
  asOf: string;
}) {
  const visible = MEMBER_COLUMNS.filter((c) => columns.includes(c.key));

  return (
    <div className="relative overflow-x-auto">
      <table className={cn(tableClass, "block md:table")}>
        <thead className="hidden md:table-header-group">
          <tr className={theadRowClass}>
            <th scope="col" className={cn(thClass, "sticky left-0 z-10 bg-muted")}>
              Nama
            </th>
            {visible.map((column) => (
              <th key={column.key} scope="col" className={cn(thClass, column.key === "whatsapp" && "text-center")}>
                {column.key === "whatsapp" ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {members.map((member) => (
            <tr
              key={member.id}
              className={cn(trClass, "grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-4 py-2 md:table-row md:p-0")}
            >
              <th
                scope="row"
                className="block bg-transparent p-0 text-left font-medium md:sticky md:left-0 md:z-10 md:table-cell md:bg-card md:px-4 md:py-2.5 md:group-hover/row:bg-muted"
              >
                <Link
                  href={`/dashboard/anggota/${member.id}`}
                  className="flex min-h-11 items-center gap-2.5 hover:underline md:whitespace-nowrap xl:min-h-0"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  {member.name}
                </Link>
              </th>
              {visible.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    tdClass,
                    "flex items-center justify-between gap-3 px-0 py-0 text-sm whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap",
                    column.key === "tag" && "md:min-w-72 md:whitespace-normal",
                    column.key === "whatsapp" ? "col-start-2 row-start-1 md:py-1 md:text-center" : "col-span-2",
                  )}
                >
                  {column.key !== "whatsapp" && (
                    <span className="shrink-0 text-xs text-muted-foreground md:hidden">{column.label}</span>
                  )}
                  <span className="min-w-0 text-right md:[text-align:inherit]">{cell(member, column.key, asOf)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
