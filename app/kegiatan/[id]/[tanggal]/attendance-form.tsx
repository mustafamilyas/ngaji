"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAttendanceAction } from "@/app/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/validation/enums";

export type AttendanceMemberRow = {
  id: number;
  name: string;
  current?: AttendanceStatus;
};

const STATUS_LABEL: Record<AttendanceStatus, string> = { HADIR: "Hadir", IZIN: "Izin" };
const SUGGESTION_LIMIT = 8;

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
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim().toLowerCase();
  const suggestions =
    trimmedQuery === ""
      ? []
      : members.filter((m) => m.name.toLowerCase().includes(trimmedQuery)).slice(0, SUGGESTION_LIMIT);
  const markedMembers = members.filter((m) => statuses[m.id] !== undefined);

  const hadirCount = members.reduce((n, m) => n + (statuses[m.id] === "HADIR" ? 1 : 0), 0);
  const izinCount = members.reduce((n, m) => n + (statuses[m.id] === "IZIN" ? 1 : 0), 0);

  function mark(memberId: number, value: AttendanceStatus) {
    if (readOnly) return;
    setSaved(false);
    setStatuses((prev) => ({ ...prev, [memberId]: prev[memberId] === value ? undefined : value }));
    setQuery("");
    setHighlight(0);
    searchRef.current?.focus();
  }

  function unmark(memberId: number) {
    if (readOnly) return;
    setSaved(false);
    setStatuses((prev) => ({ ...prev, [memberId]: undefined }));
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = suggestions[highlight] ?? suggestions[0];
      if (target) mark(target.id, "HADIR");
    } else if (event.key === "Escape") {
      setQuery("");
    }
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md border p-2">
          <p className="text-lg font-semibold">{hadirCount}</p>
          <p className="text-xs text-muted-foreground">Hadir</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-lg font-semibold">{izinCount}</p>
          <p className="text-xs text-muted-foreground">Izin</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-lg font-semibold">{members.length - hadirCount - izinCount}</p>
          <p className="text-xs text-muted-foreground">Belum absen</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Total {members.length} anggota diharapkan hadir.</p>

      {!readOnly && members.length > 0 && (
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Cari nama anggota…"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-background shadow-md">
              {suggestions.map((member, i) => (
                <li
                  key={member.id}
                  className={cn("flex items-center justify-between gap-2 px-3 py-2 text-sm", i === highlight && "bg-muted")}
                >
                  <span className="truncate">{member.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => mark(member.id, "HADIR")}
                      className={cn(
                        "h-8 rounded-md border px-2 text-xs",
                        statuses[member.id] === "HADIR"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-muted",
                      )}
                    >
                      Hadir
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(member.id, "IZIN")}
                      className={cn(
                        "h-8 rounded-md border px-2 text-xs",
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
            </ul>
          )}
          {trimmedQuery !== "" && suggestions.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Tidak ada anggota yang cocok.</p>
          )}
        </div>
      )}

      <ul className="flex flex-col divide-y">
        {markedMembers.map((member) => {
          const status = statuses[member.id]!;
          return (
            <li key={member.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span>{member.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    status === "HADIR" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {STATUS_LABEL[status]}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => unmark(member.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {markedMembers.length === 0 && (
          <li className="py-2.5 text-sm text-muted-foreground">
            {members.length === 0
              ? "Tidak ada anggota yang diharapkan hadir."
              : "Belum ada yang ditandai hadir/izin. Cari nama di atas untuk menandai."}
          </li>
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
