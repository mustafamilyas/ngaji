import { MEMBER_STATUS_LABELS } from "@/lib/member/labels";
import { cn } from "@/lib/utils";
import type { MemberStatus } from "@/lib/validation/enums";

const STATUS_CLASS: Record<MemberStatus, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PINDAH: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  KELUAR: "bg-muted text-muted-foreground",
  MENINGGAL: "bg-muted text-muted-foreground",
};

export function MemberStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[status as MemberStatus])}
    >
      {MEMBER_STATUS_LABELS[status as MemberStatus] ?? status}
    </span>
  );
}
