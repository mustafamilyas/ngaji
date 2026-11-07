import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { MAX_IMPORT_ERRORS_SHOWN, MAX_IMPORT_FILE_BYTES } from "@/lib/constants";
import { ValidationError } from "@/lib/errors";
import { listLeafGroupsInScope } from "@/lib/group/levels";
import { assertLeafGroup } from "@/lib/member/mutations";
import { resolveGroup } from "@/lib/resolve";
import type { CreateMemberInput } from "@/lib/validation/member";
import { IMPORT_COLUMNS, type ImportColumnKey, matchColumns } from "./columns";
import { parseImportDate } from "./dates";
import { decodeCsv } from "./decode";
import { markDuplicates } from "./duplicates";
import { existingDuplicateKeys } from "./existing";
import { createGroupResolver, type GroupResolution } from "./groups";
import { parseCsv } from "./parse";
import { convertRow, type RowCells, type RowError } from "./rows";

export type ImportError = { rowNumber: number; column: ImportColumnKey; message: string };

/** What the preview shows. Holds counts, column names and row numbers only, never cell values. */
export type ImportReport = {
  validCount: number;
  invalidCount: number;
  /** Duplicates among the valid rows. */
  duplicateCount: number;
  /** At most `MAX_IMPORT_ERRORS_SHOWN`; `totalErrors` says how many there are. */
  errors: ImportError[];
  totalErrors: number;
  ignoredColumns: string[];
  /** True when rows named their own group, so no single group applies to the whole file. */
  usedGroupColumn: boolean;
};

export type ImportRow = { rowNumber: number; data: CreateMemberInput; duplicate: boolean };

/** A file-level failure carries a fixed message; otherwise the report plus the valid rows. */
export type Analysis = { ok: false; error: string } | { ok: true; report: ImportReport; rows: ImportRow[] };

/**
 * Decides which group each row goes to. With a `grup` column every row names a leaf group in the user's scope
 * (the chosen group is ignored); without one, the chosen group applies and is resolved and authorized up front.
 * Throws NotFoundError / ForbiddenError / ValidationError for the chosen group.
 */
async function groupAssigner(session: SessionUser, usesColumn: boolean, chosenGroupId: number | undefined) {
  if (!usesColumn) {
    if (chosenGroupId === undefined) throw new ValidationError("Pilih grup tujuan");
    const group = await resolveGroup(session, chosenGroupId);
    authorize(session, "member.create", { groupPath: group.path });
    await assertLeafGroup(group);
    return { usesColumn, groupFor: (): GroupResolution => ({ groupId: group.id }), authorizeUsed: () => {} };
  }

  const leaves = await listLeafGroupsInScope(session);
  const resolve = createGroupResolver(leaves);
  const pathOf = new Map(leaves.map((leaf) => [leaf.id, leaf.path]));
  const used = new Set<number>();
  return {
    usesColumn,
    groupFor: (cells: RowCells): GroupResolution => {
      const resolved = resolve(cells.grup ?? "");
      if ("groupId" in resolved) used.add(resolved.groupId);
      return resolved;
    },
    // Same check importMembers makes at confirm, so the preview cannot promise what confirm would refuse.
    authorizeUsed: () => {
      for (const id of used) authorize(session, "member.create", { groupPath: pathOf.get(id)! });
    },
  };
}

/**
 * The whole read-only pipeline, shared by preview and confirm so confirm re-validates by construction.
 * The group is resolved and authorized first, so a bad group answers the same whatever the file holds.
 * Throws NotFoundError / ForbiddenError / ValidationError for group problems.
 */
export async function analyzeImport(session: SessionUser, file: File, groupId: number | undefined): Promise<Analysis> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, error: "Simpan file sebagai CSV (.csv) lalu unggah lagi." };
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, error: `Ukuran file melebihi batas ${Math.floor(MAX_IMPORT_FILE_BYTES / 1000)} KB.` };
  }

  const parsed = parseCsv(decodeCsv(new Uint8Array(await file.arrayBuffer())));
  if (!parsed.ok) return parsed;

  const columns = matchColumns(parsed.headers);
  if (columns.missing.length > 0) return { ok: false, error: `Kolom wajib tidak ditemukan: ${columns.missing.join(", ")}.` };
  if (columns.repeated.length > 0) return { ok: false, error: `Kolom muncul lebih dari sekali: ${columns.repeated.join(", ")}.` };

  const assign = await groupAssigner(session, columns.indexes.grup !== undefined, groupId);

  const cellsOf = (row: string[]) => {
    const cells: RowCells = {};
    for (const { key } of IMPORT_COLUMNS) {
      const index = columns.indexes[key];
      if (index !== undefined) cells[key] = row[index] ?? "";
    }
    return cells;
  };

  const errors: ImportError[] = [];
  let totalErrors = 0;
  let invalidCount = 0;
  const converted: { rowNumber: number; data: CreateMemberInput | null }[] = [];
  // Name and birth date of every row that has both, even if another field is bad: a twin is still a twin.
  const identities: ({ name: string; birthDate: string } | null)[] = [];

  for (const { rowNumber, cells: raw } of parsed.rows) {
    const cells = cellsOf(raw);
    const group = assign.groupFor(cells);
    // A row with a bad group still runs the other checks, so all its problems show at once; the placeholder id is never used.
    const result = convertRow(cells, { groupId: "groupId" in group ? group.groupId : 1, timeZone: session.timeZone });
    const rowErrors: RowError[] = [
      ...("errors" in result ? result.errors : []),
      ...("error" in group ? [{ column: "grup" as const, message: group.error }] : []),
    ];
    if (rowErrors.length > 0) {
      invalidCount++;
      for (const error of rowErrors) {
        totalErrors++;
        if (errors.length < MAX_IMPORT_ERRORS_SHOWN) errors.push({ rowNumber, ...error });
      }
    }
    converted.push({ rowNumber, data: rowErrors.length === 0 && "data" in result ? result.data : null });

    const name = (cells.nama ?? "").trim();
    const birthDate = parseImportDate(cells.tanggal_lahir ?? "");
    identities.push(name && birthDate ? { name, birthDate } : null);
  }

  const existing = await existingDuplicateKeys(
    session,
    identities.flatMap((identity) => (identity ? [identity.birthDate] : [])),
  );
  const duplicates = markDuplicates(identities, existing);

  assign.authorizeUsed();

  const rows: ImportRow[] = [];
  converted.forEach(({ rowNumber, data }, index) => {
    if (data) rows.push({ rowNumber, data, duplicate: duplicates[index] });
  });

  return {
    ok: true,
    rows,
    report: {
      validCount: rows.length,
      invalidCount,
      duplicateCount: rows.filter((row) => row.duplicate).length,
      errors,
      totalErrors,
      ignoredColumns: columns.ignored,
      usedGroupColumn: assign.usesColumn,
    },
  };
}
