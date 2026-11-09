import { today } from "@/lib/dates";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import { createMemberSchema, type CreateMemberInput } from "@/lib/validation/member";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import { IMPORT_COLUMNS, type ImportColumnKey } from "./columns";
import { parseImportDate } from "./dates";

export type RowCells = Partial<Record<ImportColumnKey, string>>;
/** Messages never repeat the cell value, so previews and logs stay free of PII. */
export type RowError = { column: ImportColumnKey; message: string };
export type RowResult = { data: CreateMemberInput } | { errors: RowError[] };

/** Where each field of `createMemberSchema` comes from in the file. */
const FIELD_COLUMNS: Record<string, ImportColumnKey> = {
  name: "nama",
  birthPlace: "tempat_lahir",
  birthDate: "tanggal_lahir",
  sex: "jenis_kelamin",
  address: "alamat",
  maritalStatus: "status_nikah",
  workStatus: "pekerjaan",
  phone: "no_hp",
  email: "email",
  status: "status",
  joinedAt: "tanggal_masuk",
  exitedAt: "tanggal_keluar",
  groupId: "grup",
};

const SCIENTIFIC_RE = /^\d+(\.\d+)?e[+-]?\d+$/i;

const normalize = (text: string) => text.trim().toLowerCase().replace(/[\s_]+/g, "_");

/** Maps the stored value or its label (any case, spaces like underscores) to the stored value. */
function enumLookup(values: readonly string[], labelOf: (value: string) => string) {
  const map = new Map<string, string>();
  for (const value of values) {
    map.set(normalize(value), value);
    map.set(normalize(labelOf(value)), value);
  }
  return map;
}

const SEX_LOOKUP = enumLookup(SEXES, (value) => SEX_LABELS[value as keyof typeof SEX_LABELS]);
const MARITAL_LOOKUP = enumLookup(MARITAL_STATUSES, formatEnumLabel);
const WORK_LOOKUP = enumLookup(WORK_STATUSES, formatEnumLabel);
const STATUS_LOOKUP = enumLookup(MEMBER_STATUSES, formatEnumLabel);

const COLUMN_ORDER = new Map(IMPORT_COLUMNS.map((column, index) => [column.key, index]));

/** Converts one file row into member input, running the same schema as the member form. */
export function convertRow(cells: RowCells, options: { groupId: number; timeZone: string }): RowResult {
  const cell = (key: ImportColumnKey) => (cells[key] ?? "").trim();
  const errors = new Map<ImportColumnKey, string>();
  const fail = (column: ImportColumnKey, message: string) => {
    if (!errors.has(column)) errors.set(column, message);
  };

  for (const { key, required } of IMPORT_COLUMNS) {
    if (required && !cell(key)) fail(key, "Wajib diisi");
  }

  const pick = (key: ImportColumnKey, lookup: Map<string, string>, fallback = "") => {
    const text = cell(key);
    if (!text) return fallback;
    const value = lookup.get(normalize(text));
    if (!value) fail(key, "Nilai tidak dikenal");
    return value ?? "";
  };

  const pickDate = (key: ImportColumnKey, fallback = "") => {
    const text = cell(key);
    if (!text) return fallback;
    const date = parseImportDate(text);
    if (!date) fail(key, "Tanggal tidak valid");
    return date ?? "";
  };

  if (SCIENTIFIC_RE.test(cell("no_hp"))) fail("no_hp", "Nomor HP tidak valid");

  const parsed = createMemberSchema.safeParse({
    name: cell("nama"),
    birthPlace: cell("tempat_lahir"),
    birthDate: pickDate("tanggal_lahir"),
    sex: pick("jenis_kelamin", SEX_LOOKUP),
    address: cell("alamat"),
    phone: cell("no_hp"),
    maritalStatus: pick("status_nikah", MARITAL_LOOKUP),
    workStatus: pick("pekerjaan", WORK_LOOKUP),
    email: cell("email"),
    status: pick("status", STATUS_LOOKUP, "AKTIF"),
    joinedAt: pickDate("tanggal_masuk", today(options.timeZone)),
    exitedAt: pickDate("tanggal_keluar"),
    groupId: options.groupId,
  });

  // Schema issues on a column we already reported are just the same problem seen again.
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const column = FIELD_COLUMNS[String(issue.path[0])];
      if (column) fail(column, issue.message);
    }
  }

  if (parsed.success && errors.size === 0) return { data: parsed.data };
  return {
    errors: [...errors]
      .map(([column, message]) => ({ column, message }))
      .sort((a, b) => COLUMN_ORDER.get(a.column)! - COLUMN_ORDER.get(b.column)!),
  };
}
