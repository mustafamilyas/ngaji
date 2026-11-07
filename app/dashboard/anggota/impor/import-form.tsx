"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { GroupAutocomplete, type GroupAutocompleteOption } from "@/components/group-autocomplete";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants";
import type { ImportReport } from "@/lib/member/import/analyze";
import { IMPORT_COLUMNS } from "@/lib/member/import/columns";
import { COLUMN_HELP } from "@/lib/member/import/help";
import { type ConfirmImportResult, confirmMemberImportAction, previewMemberImportAction } from "./actions";

type Done = Extract<ConfirmImportResult, { status: "done" }>;

/** Same checks the server makes, so an oversized body never reaches the framework's 1MB limit. */
function checkFile(file: File | null): string | null {
  if (!file) return "Pilih file CSV.";
  if (!file.name.toLowerCase().endsWith(".csv")) return "Simpan file sebagai CSV (.csv) lalu unggah lagi.";
  if (file.size > MAX_IMPORT_FILE_BYTES) return `Ukuran file melebihi batas ${Math.floor(MAX_IMPORT_FILE_BYTES / 1000)} KB.`;
  return null;
}

export function ImportForm({ leafGroups }: { leafGroups: GroupAutocompleteOption[] }) {
  const [groupId, setGroupId] = useState<number | undefined>(leafGroups.length === 1 ? leafGroups[0].id : undefined);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [pending, startTransition] = useTransition();

  /** A preview belongs to one group and one file; changing either drops it. */
  function clearOutcome() {
    setReport(null);
    setDone(null);
    setError(null);
    setForce(false);
  }

  function formData() {
    const data = new FormData();
    if (file) data.set("file", file);
    if (groupId !== undefined) data.set("groupId", String(groupId));
    return data;
  }

  function check() {
    clearOutcome();
    const problem = checkFile(file);
    if (problem) return setError(problem);
    startTransition(async () => {
      const result = await previewMemberImportAction(formData());
      if (result.ok) setReport(result.data);
      else setError(result.error);
    });
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const data = formData();
      if (force) data.set("force", "on");
      const result = await confirmMemberImportAction(data);
      if (!result.ok) return setError(result.error);
      if (result.data.status === "invalid") return setReport(result.data.report);
      setDone(result.data);
    });
  }

  function startOver() {
    clearOutcome();
    setFile(null);
    setFileKey((key) => key + 1);
  }

  const importable = report ? (force ? report.validCount : report.validCount - report.duplicateCount) : 0;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Simpan data dari Excel sebagai CSV, lalu unggah di sini. Anda melihat hasil pemeriksaan lebih dulu; tidak ada anggota
        yang dibuat sebelum Anda menekan tombol impor.{" "}
        <a href="/dashboard/anggota/impor/template" download className="font-medium text-foreground underline underline-offset-2">
          Unduh template CSV
        </a>
      </p>

      <details className="rounded-lg border p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium xl:min-h-0">Format kolom</summary>
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          {IMPORT_COLUMNS.map(({ key, required }) => (
            <li key={key} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <code className="font-mono font-medium">{key}</code>
                <span className="text-xs text-muted-foreground">{required ? "wajib" : "opsional"}</span>
              </span>
              <span className="text-muted-foreground">{COLUMN_HELP[key]}</span>
            </li>
          ))}
        </ul>
      </details>

      {done ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm font-medium">{`${done.created} anggota dibuat, ${done.skipped} duplikat dilewati`}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={done.groupId === null ? "/dashboard/anggota" : `/dashboard/grup/${done.groupId}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-base font-medium xl:h-9 xl:text-sm"
            >
              {done.groupId === null ? "Lihat daftar anggota" : "Lihat daftar anggota grup"}
            </Link>
            <Button type="button" variant="outline" size="lg" onClick={startOver}>
              Impor file lain
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {leafGroups.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <GroupAutocomplete
                  id="groupId"
                  label="Grup tujuan"
                  groups={leafGroups}
                  value={groupId}
                  onChange={(id) => {
                    setGroupId(id);
                    clearOutcome();
                  }}
                />
                <p className="text-xs text-muted-foreground">Tidak dipakai jika file punya kolom grup.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada grup tujuan di lingkup Anda.</p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="file" className="text-sm font-medium">
                File CSV
              </label>
              <Input
                key={fileKey}
                id="file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  clearOutcome();
                }}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div>
            <Button type="button" size="lg" className="w-full sm:w-auto" disabled={pending || !file} onClick={check}>
              {pending && !report ? "Memeriksa…" : "Periksa file"}
            </Button>
          </div>

          {report ? (
            <section aria-label="Hasil pemeriksaan" className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
              <p className="font-medium">
                {report.invalidCount === 0 ? `${report.validCount} baris siap diimpor` : `${report.validCount} baris valid`}
              </p>
              {report.invalidCount > 0 ? (
                <p>{`${report.invalidCount} baris bermasalah. Perbaiki file lalu periksa lagi; tidak ada anggota yang dibuat selama masih ada kesalahan.`}</p>
              ) : null}
              {report.ignoredColumns.length > 0 ? (
                <p className="text-muted-foreground">{`Kolom diabaikan: ${report.ignoredColumns.join(", ")}`}</p>
              ) : null}
              {report.errors.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <ul className="flex flex-col gap-1">
                    {report.errors.map((item, index) => (
                      <li key={index}>{`Baris ${item.rowNumber}, kolom ${item.column}: ${item.message}`}</li>
                    ))}
                  </ul>
                  {report.errors.length < report.totalErrors ? (
                    <p className="text-muted-foreground">{`Menampilkan ${report.errors.length} dari ${report.totalErrors} kesalahan`}</p>
                  ) : null}
                </div>
              ) : null}
              {report.duplicateCount > 0 ? (
                <div className="flex flex-col gap-2">
                  <p>{`${report.duplicateCount} kemungkinan duplikat (nama dan tanggal lahir sama dengan anggota yang ada atau baris sebelumnya). Dilewati kecuali Anda mencentang Tetap impor.`}</p>
                  <label className="flex min-h-11 items-center gap-2 xl:min-h-0">
                    <Checkbox checked={force} onCheckedChange={(checked) => setForce(checked === true)} />
                    <span>Tetap impor</span>
                  </label>
                </div>
              ) : null}
              {report.totalErrors === 0 ? (
                <div>
                  <Button type="button" size="lg" className="w-full sm:w-auto" disabled={pending || importable === 0} onClick={confirm}>
                    {pending ? "Mengimpor…" : `Impor ${importable} anggota`}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
