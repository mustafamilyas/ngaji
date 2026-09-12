"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAttendanceAction } from "@/app/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/validation/enums";

export type AttendanceMemberRow = {
  id: number;
  name: string;
  current?: AttendanceStatus;
};

export function AttendanceForm({
  activityId,
  groupId,
  date,
  members,
  readOnly,
}: {
  activityId: number;
  groupId: number;
  date: string;
  members: AttendanceMemberRow[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus | undefined>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.current])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(memberId: number, value: AttendanceStatus) {
    if (readOnly) return;
    setSaved(false);
    setStatuses((prev) => ({ ...prev, [memberId]: prev[memberId] === value ? undefined : value }));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const entries = Object.entries(statuses)
        .filter((entry): entry is [string, AttendanceStatus] => entry[1] !== undefined)
        .map(([memberId, status]) => ({ memberId: Number(memberId), status }));

      const result = await saveAttendanceAction({ activityId, groupId, date, entries });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-2 py-2.5">
            <span className="text-sm">{member.name}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => toggle(member.id, "HADIR")}
                className={cn(
                  "h-9 rounded-md border px-3 text-sm disabled:opacity-50",
                  statuses[member.id] === "HADIR"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted",
                )}
              >
                Hadir
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => toggle(member.id, "IZIN")}
                className={cn(
                  "h-9 rounded-md border px-3 text-sm disabled:opacity-50",
                  statuses[member.id] === "IZIN"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted",
                )}
              >
                Izin
              </button>
            </div>
          </li>
        ))}
        {members.length === 0 && (
          <li className="py-2.5 text-sm text-muted-foreground">Tidak ada anggota yang diharapkan hadir.</li>
        )}
      </ul>

      {!readOnly && members.length > 0 && (
        <Button onClick={onSave} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan absensi"}
        </Button>
      )}
      {saved && !pending && <p className="text-sm text-muted-foreground">Tersimpan.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
