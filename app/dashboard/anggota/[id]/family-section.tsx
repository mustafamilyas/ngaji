"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { linkMembersAction, searchRelativeCandidatesAction, unlinkMembersAction } from "@/app/dashboard/anggota/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { touchField } from "@/components/ui/touch";
import type { ActionResult } from "@/lib/errors";
import { useKeepValues } from "@/lib/forms/use-keep-values";
import type { Relative } from "@/lib/member/relation-queries";
import type { RelationType } from "@/lib/validation/enums";

/** Relationship in plain words, from the viewed member's point of view ("… adalah Ayah/Ibu dari <picked>"). */
const CHOICES: { value: string; type: RelationType; viewedIsFrom: boolean; label: string }[] = [
  { value: "ORANG_TUA_FROM", type: "ORANG_TUA", viewedIsFrom: true, label: "adalah Ayah/Ibu dari" },
  { value: "ORANG_TUA_TO", type: "ORANG_TUA", viewedIsFrom: false, label: "adalah Anak dari" },
  { value: "WALI_FROM", type: "WALI", viewedIsFrom: true, label: "adalah Wali dari" },
  { value: "WALI_TO", type: "WALI", viewedIsFrom: false, label: "adalah Anak asuh dari" },
  { value: "PASANGAN", type: "PASANGAN", viewedIsFrom: true, label: "adalah Suami/Istri dari" },
  { value: "SAUDARA", type: "SAUDARA", viewedIsFrom: true, label: "adalah Saudara dari" },
];

const SEARCH_DELAY_MS = 300;

type Candidate = { id: number; name: string; groupName: string; code: string | null };

/** Keluarga card on the Profil tab: relatives, "Tambah keluarga", and remove (member-relations spec). */
export function FamilySection({ memberId, memberName, relatives }: { memberId: number; memberName: string; relatives: Relative[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keluarga</CardTitle>
        <CardAction>
          <AddRelativeDialog memberId={memberId} memberName={memberName} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {relatives.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Belum ada data keluarga</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {relatives.map((relative, index) => (
              <li key={relative.inScope ? relative.relationId : `out-${index}`} className="flex min-h-11 items-center gap-3 py-1">
                <span className="w-24 shrink-0 text-sm text-muted-foreground sm:w-36">{relative.label}</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  {relative.inScope ? (
                    <Link
                      href={`/dashboard/anggota/${relative.memberId}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium hover:underline xl:min-h-0"
                    >
                      {relative.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{relative.name}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{relative.groupName}</span>
                </div>
                {relative.inScope && <RemoveRelativeDialog relationId={relative.relationId} label={relative.label} name={relative.name} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RemoveRelativeDialog({ relationId, label, name }: { relationId: number; label: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(undefined);
    startTransition(async () => {
      const result = await unlinkMembersAction({ relationId });
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger aria-label={`Hapus hubungan ${label} ${name}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <X />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Hapus hubungan keluarga?</DialogTitle>
        <DialogDescription>
          {name} ({label}) tidak lagi tercatat sebagai keluarga. Tindakan ini tercatat di log audit.
        </DialogDescription>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="mt-5">
          <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Batal</DialogClose>
          <Button variant="destructive" size="lg" onClick={remove} disabled={pending}>
            {pending ? "Menghapus…" : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRelativeDialog({ memberId, memberName }: { memberId: number; memberName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "lg" })}>
        <Plus />
        Tambah keluarga
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Tambah keluarga</DialogTitle>
        <DialogDescription>Hanya anggota dalam cakupan Anda yang bisa dipilih.</DialogDescription>
        {/* Mounted only while open, so closing resets the form and the search. */}
        <AddRelativeForm memberId={memberId} memberName={memberName} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddRelativeForm({ memberId, memberName, onDone }: { memberId: number; memberName: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult<unknown> | null, FormData>(async (_prev, formData) => {
    const choice = CHOICES.find((c) => c.value === formData.get("choice"));
    const otherId = Number(formData.get("otherId"));
    if (!choice) return { ok: false, error: "Pilih jenis hubungan" };
    if (!otherId) return { ok: false, error: "Pilih anggota terlebih dahulu" };
    const result = await linkMembersAction({
      fromMemberId: choice.viewedIsFrom ? memberId : otherId,
      toMemberId: choice.viewedIsFrom ? otherId : memberId,
      type: choice.type,
    });
    if (result.ok) onDone();
    return result;
  }, null);
  const onSubmit = useKeepValues(formAction);

  const [query, setQuery] = useState("");
  const [found, setCandidates] = useState<Candidate[]>([]);
  const [foundError, setSearchError] = useState<string>();
  // A cleared box hides the last answer without resetting state from an effect.
  const searching = query.trim() !== "";
  const candidates = searching ? found : [];
  const searchError = searching ? foundError : undefined;

  // Debounced search; `stale` drops an answer that arrives after a newer keystroke.
  useEffect(() => {
    if (!query.trim()) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await searchRelativeCandidatesAction({ memberId, query });
      if (stale) return;
      setSearchError(result.ok ? undefined : result.error);
      setCandidates(result.ok ? result.data : []);
    }, SEARCH_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [memberId, query]);

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="relative-choice" className="text-sm font-medium">
          {memberName}
        </label>
        <select id="relative-choice" name="choice" defaultValue={CHOICES[0].value} className={touchField}>
          {CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} …
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="relative-search" className="text-sm font-medium">
          Cari anggota (nama atau kode)
        </label>
        <Input id="relative-search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      </div>

      {searchError && (
        <p role="alert" className="text-sm text-destructive">
          {searchError}
        </p>
      )}
      {searching && !searchError && candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
      ) : (
        candidates.length > 0 && (
          <fieldset className="flex flex-col divide-y rounded-lg border">
            <legend className="sr-only">Hasil pencarian</legend>
            {candidates.map((c) => (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                <input type="radio" name="otherId" value={c.id} className="size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.groupName}
                    {c.code && ` · ${c.code}`}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )
      )}

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <DialogClose className={buttonVariants({ variant: "ghost", size: "lg" })}>Batal</DialogClose>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
