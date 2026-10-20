"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { setAttendanceAction } from "@/app/dashboard/kegiatan/actions";
import { SortIcon, TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { MAX_ATTENDANCE_NOTE_LENGTH } from "@/lib/constants";
import type { SortDir } from "@/lib/sort";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/validation/enums";

export type AttendanceTableRow = {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  status?: AttendanceStatus;
  note?: string | null;
};

type Entry = { status?: AttendanceStatus; note?: string | null };
type StatusFilter = "ALL" | AttendanceStatus | "NONE";
type SortKey = "name" | "status";

const STATUS_LABEL: Record<AttendanceStatus | "NONE", string> = { HADIR: "Hadir", IZIN: "Izin", NONE: "Belum absen" };
const STATUS_ORDER: Record<AttendanceStatus | "NONE", number> = { HADIR: 0, IZIN: 1, NONE: 2 };
const STATUS_BADGE: Record<AttendanceStatus | "NONE", string> = {
  HADIR: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  IZIN: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  NONE: "bg-muted text-muted-foreground",
};

const controlClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function StatTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className={cn("text-2xl font-semibold tabular-nums", className)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SortTh({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const dir = sort.key === column ? sort.dir : undefined;
  return (
    <th
      scope="col"
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
      className={thClass}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground",
          dir && "text-foreground",
        )}
      >
        {label}
        <SortIcon dir={dir} />
      </button>
    </th>
  );
}

/** Reason field for an IZIN row: saves on blur or Enter when the text changed. */
function NoteInput({
  memberName,
  note,
  disabled,
  onSave,
}: {
  memberName: string;
  note: string;
  disabled: boolean;
  onSave: (note: string) => void;
}) {
  const [value, setValue] = useState(note);
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value.trim() !== note) onSave(value.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setValue(note);
      }}
      disabled={disabled}
      maxLength={MAX_ATTENDANCE_NOTE_LENGTH}
      placeholder="Tulis alasan…"
      aria-label={`Alasan izin ${memberName}`}
      className={cn(controlClass, "h-8 w-full min-w-40")}
    />
  );
}

/**
 * Attendance for one occurrence as a table: every expected member of the
 * leaf groups in view, toggled Hadir / Izin one row at a time — each change
 * is saved immediately via `setAttendanceAction`. Sorting and filtering are
 * client-side; the list is not paginated (DESIGN.md §5.6).
 */
export function AttendanceTable({
  activityId,
  date,
  rows,
  groups,
  initialGroupId,
  editable,
}: {
  activityId: number;
  /** The rule's key date — what the server resolves the occurrence by. */
  date: string;
  rows: AttendanceTableRow[];
  groups: { id: number; name: string }[];
  initialGroupId?: number;
  editable: boolean;
}) {
  const [entries, setEntries] = useState<Record<number, Entry>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { status: r.status, note: r.note }])),
  );
  const [pending, setPending] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState<number | "ALL">(initialGroupId ?? "ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const statusOf = (id: number): AttendanceStatus | "NONE" => entries[id]?.status ?? "NONE";

  const inGroup = rows.filter((r) => groupFilter === "ALL" || r.groupId === groupFilter);
  const hadirCount = inGroup.filter((r) => statusOf(r.id) === "HADIR").length;
  const izinCount = inGroup.filter((r) => statusOf(r.id) === "IZIN").length;

  const trimmedQuery = query.trim().toLowerCase();
  const visible = inGroup
    .filter((r) => statusFilter === "ALL" || statusOf(r.id) === statusFilter)
    .filter((r) => trimmedQuery === "" || r.name.toLowerCase().includes(trimmedQuery))
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, "id-ID");
      const primary = sort.key === "status" ? STATUS_ORDER[statusOf(a.id)] - STATUS_ORDER[statusOf(b.id)] : byName;
      return (sort.dir === "asc" ? primary : -primary) || byName;
    });

  function onSort(key: SortKey) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  }

  async function save(memberId: number, status: AttendanceStatus | null, note?: string) {
    const previous = entries[memberId];
    setError(null);
    setEntries((prev) => ({ ...prev, [memberId]: { status: status ?? undefined, note: status === "IZIN" ? note : null } }));
    setPending((prev) => new Set(prev).add(memberId));

    const result = await setAttendanceAction({ activityId, date, memberId, status, note });

    setPending((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    if (!result.ok) {
      setEntries((prev) => ({ ...prev, [memberId]: previous }));
      setError(result.error);
      return;
    }
    setEntries((prev) => ({
      ...prev,
      [memberId]: { status: result.data.status ?? undefined, note: result.data.note },
    }));
  }

  function toggle(memberId: number, value: AttendanceStatus) {
    const current = entries[memberId]?.status;
    void save(memberId, current === value ? null : value, value === "IZIN" ? entries[memberId]?.note ?? undefined : undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Hadir" value={hadirCount} className="text-emerald-700 dark:text-emerald-400" />
        <StatTile label="Izin" value={izinCount} className="text-amber-700 dark:text-amber-400" />
        <StatTile label="Belum absen" value={inGroup.length - hadirCount - izinCount} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <TableCard
        title={
          visible.length === inGroup.length
            ? `${inGroup.length} anggota diharapkan hadir`
            : `${visible.length} dari ${inGroup.length} anggota`
        }
        toolbar={
          <>
            <div className="relative w-full sm:w-56">
              <Search aria-hidden className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama…"
                aria-label="Cari nama anggota"
                className={cn(controlClass, "w-full pl-9")}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter status"
              className={controlClass}
            >
              <option value="ALL">Semua status</option>
              <option value="HADIR">Hadir</option>
              <option value="IZIN">Izin</option>
              <option value="NONE">Belum absen</option>
            </select>
            {groups.length > 1 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                aria-label="Filter grup"
                className={controlClass}
              >
                <option value="ALL">Semua grup</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr className={theadRowClass}>
                <SortTh label="Nama" column="name" sort={sort} onSort={onSort} />
                <SortTh label="Status" column="status" sort={sort} onSort={onSort} />
                <th scope="col" className={thClass}>
                  Alasan
                </th>
                {editable && (
                  <th scope="col" className={cn(thClass, "text-right")}>
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const status = statusOf(row.id);
                const note = entries[row.id]?.note ?? "";
                const busy = pending.has(row.id);
                return (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>
                      <p className="font-medium">{row.name}</p>
                      {groups.length > 1 && <p className="text-xs text-muted-foreground">{row.groupName}</p>}
                    </td>
                    <td className={tdClass}>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[status])}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className={cn(tdClass, "whitespace-normal")}>
                      {status === "IZIN" && editable ? (
                        <NoteInput
                          key={note}
                          memberName={row.name}
                          note={note}
                          disabled={busy}
                          onSave={(value) => void save(row.id, "IZIN", value)}
                        />
                      ) : (
                        <span className={cn(!note && "text-muted-foreground")}>{note || "—"}</span>
                      )}
                    </td>
                    {editable && (
                      <td className={cn(tdClass, "text-right")}>
                        <div className="inline-flex gap-1">
                          {(["HADIR", "IZIN"] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggle(row.id, value)}
                              disabled={busy}
                              aria-pressed={status === value}
                              aria-label={`Tandai ${row.name} ${STATUS_LABEL[value].toLowerCase()}`}
                              className={cn(
                                "h-8 min-w-14 rounded-md border px-2 text-xs transition-colors disabled:opacity-50",
                                status === value
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input hover:bg-muted",
                              )}
                            >
                              {STATUS_LABEL[value]}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={editable ? 4 : 3} className={cn(tdClass, "py-6 text-center text-muted-foreground")}>
                    {rows.length === 0 ? "Tidak ada anggota yang diharapkan hadir." : "Tidak ada anggota yang cocok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
    </div>
  );
}
