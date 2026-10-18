"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { checkInAction, listCheckInMembersAction } from "@/app/dashboard/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { QuickRegisterDialog } from "./quick-register-dialog";
import { Autocomplete, type AutocompleteItem } from "@/components/autocomplete";

type CheckInMember = { id: number; name: string; checkedIn: boolean };
type Welcome = { name: string; groupName: string; alreadyCheckedIn: boolean };

const WELCOME_TOAST_MS = 4000;

export type LeafGroupOption = { id: number; name: string; parentName?: string; isDefault: boolean };

export function CheckInForm({
  activityId,
  activityName,
  date,
  ruleDate,
  startTime,
  closedReason,
  leafGroups,
  breadcrumb,
  initialGroupId,
}: {
  activityId: number;
  activityName: string;
  /** Effective date shown to the user. */
  date: string;
  /** The rule's key date — what the server resolves the occurrence by. */
  ruleDate: string;
  startTime: string;
  closedReason?: string;
  /** Every group the user may check people into; `isDefault` ones (under the owning group) are suggested first. */
  leafGroups: LeafGroupOption[];
  /** Owning group's ancestry, outermost first, shown before the group field. */
  breadcrumb: string[];
  initialGroupId?: number;
}) {
  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId);
  const [members, setMembers] = useState<CheckInMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(initialGroupId !== undefined);
  const [groupQuery, setGroupQuery] = useState(
    () => leafGroups.find((g) => g.id === initialGroupId)?.name ?? "",
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  const groupItems = useMemo<AutocompleteItem[]>(
    () => leafGroups.map((g) => ({ id: g.id, label: g.name, hint: g.parentName })),
    [leafGroups],
  );
  const defaultGroupItems = useMemo(
    () => leafGroups.filter((g) => g.isDefault).map((g) => groupItems.find((i) => i.id === g.id)!),
    [leafGroups, groupItems],
  );
  const memberItems = useMemo<AutocompleteItem[]>(
    () => members.map((m) => ({ id: m.id, label: m.name, badge: m.checkedIn ? "Sudah absen" : undefined })),
    [members],
  );
  const selected = members.find((m) => m.id === selectedId);

  useEffect(() => {
    if (groupId === undefined) return;
    let stale = false;
    listCheckInMembersAction({ activityId, groupId, date: ruleDate }).then((result) => {
      if (stale) return;
      setLoadingMembers(false);
      if (!result.ok) {
        setError(result.error);
        setMembers([]);
        return;
      }
      setMembers(result.data.members);
    });
    return () => {
      stale = true;
    };
  }, [activityId, groupId, ruleDate]);

  useEffect(() => {
    if (!welcome) return;
    const timer = setTimeout(() => setWelcome(null), WELCOME_TOAST_MS);
    return () => clearTimeout(timer);
  }, [welcome]);

  function chooseGroup(item: AutocompleteItem) {
    setGroupQuery(item.label);
    setGroupId(item.id);
    setMembers([]);
    setLoadingMembers(true);
    setQuery("");
    setSelectedId(undefined);
    setError(null);
    setTimeout(() => nameRef.current?.focus());
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (groupId === undefined || !selected) return;
    setError(null);
    startTransition(async () => {
      const result = await checkInAction({ activityId, groupId, date: ruleDate, memberId: selected.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMembers((prev) => prev.map((m) => (m.id === selected.id ? { ...m, checkedIn: true } : m)));
      // Hand the form to the next person with the group kept.
      setQuery("");
      setSelectedId(undefined);
      setTimeout(() => nameRef.current?.focus());
      setWelcome({
        name: result.data.memberName,
        groupName: result.data.groupName,
        alreadyCheckedIn: result.data.alreadyCheckedIn,
      });
    });
  }

  function onRegistered(member: { id: number; name: string }) {
    setMembers((prev) => [...prev, { ...member, checkedIn: false }]);
    setSelectedId(member.id);
    setQuery(member.name);
    setError(null);
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-16">
      <Link
        href={`/dashboard/kegiatan/${activityId}`}
        className="absolute top-4 left-4 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </Link>

      {welcome && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {welcome.alreadyCheckedIn ? "Kehadiran sudah tercatat" : "Selamat datang"}
              </p>
              <p className="truncate text-base font-semibold">{welcome.name}</p>
              <p className="truncate text-xs text-muted-foreground">{welcome.groupName}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full max-w-md flex-col gap-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{activityName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {date} · {startTime}
          </p>
        </header>

        {closedReason ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {closedReason}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {leafGroups.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Tidak ada grup yang bisa diabsen.</p>
            ) : (
              <>
                <Autocomplete
                  id="check-in-group"
                  label="Grup"
                  items={groupItems}
                  emptyItems={defaultGroupItems}
                  query={groupQuery}
                  onQueryChange={(value) => {
                    setGroupQuery(value);
                    setGroupId(undefined);
                    setMembers([]);
                    setQuery("");
                    setSelectedId(undefined);
                  }}
                  selectedId={groupId}
                  onSelect={chooseGroup}
                  placeholder="Ketik nama grup"
                  openOnFocus
                  autoFocus={initialGroupId === undefined}
                  prefix={
                    breadcrumb.length > 0 && (
                      <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                        {breadcrumb.map((name, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            {name}
                            <ChevronRight className="size-3" />
                          </span>
                        ))}
                      </p>
                    )
                  }
                />

                <Autocomplete
                  id="check-in-name"
                  label="Nama"
                  items={memberItems}
                  query={query}
                  onQueryChange={(value) => {
                    setQuery(value);
                    setSelectedId(undefined);
                  }}
                  selectedId={selectedId}
                  onSelect={(item) => {
                    setSelectedId(item.id);
                    setQuery(item.label);
                    setError(null);
                  }}
                  disabled={groupId === undefined || loadingMembers}
                  placeholder={groupId === undefined ? "Pilih grup dulu" : loadingMembers ? "Memuat…" : "Ketik nama Anda"}
                  inputRef={nameRef}
                  autoFocus={initialGroupId !== undefined}
                />

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={!selected || pending} className="h-12 rounded-xl text-base">
                  {pending ? "Menyimpan…" : "Hadir"}
                </Button>
              </>
            )}
          </form>
        )}

        {!closedReason && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Nama Anda tidak ada?</p>
            <QuickRegisterDialog
              groupId={groupId}
              groupName={leafGroups.find((g) => g.id === groupId)?.name ?? ""}
              occurrenceDate={date}
              onRegistered={onRegistered}
            />
          </div>
        )}
      </div>
    </main>
  );
}
