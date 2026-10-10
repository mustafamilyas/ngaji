import Link from "next/link";
import { MemberStatusBadge } from "@/components/member-status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ageInYears, today } from "@/lib/dates";
import { formatDate } from "@/lib/filters";
import { MEMBER_COLUMNS, type MemberColumnKey } from "@/lib/member/columns";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import type { listMembers } from "@/lib/member/queries";
import { cn } from "@/lib/utils";
import type { Sex } from "@/lib/validation/enums";

type MemberRow = Awaited<ReturnType<typeof listMembers>>["members"][number];

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
 * `/anggota` table. Server-rendered with only the viewer's chosen columns
 * (see `lib/member/columns.ts`), so hidden PII never reaches the browser.
 * Scrolls sideways on small screens with the name column pinned.
 */
export function MembersTable({ members, columns }: { members: MemberRow[]; columns: MemberColumnKey[] }) {
  const asOf = today();
  const visible = MEMBER_COLUMNS.filter((c) => columns.includes(c.key));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium">
              Nama
            </th>
            {visible.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("px-3 py-2 font-medium whitespace-nowrap", column.key === "whatsapp" && "text-center")}
              >
                {column.key === "whatsapp" ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="group/row border-b last:border-0 hover:bg-muted">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium group-hover/row:bg-muted"
              >
                <Link href={`/anggota/${member.id}`} className="whitespace-nowrap hover:underline">
                  {member.name}
                </Link>
              </th>
              {visible.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-3 py-2 whitespace-nowrap", column.key === "whatsapp" && "py-1 text-center")}
                >
                  {cell(member, column.key, asOf)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
