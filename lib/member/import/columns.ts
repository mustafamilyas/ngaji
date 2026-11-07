/** The one column list: read by the header matcher, the template, and the help text. */
export const IMPORT_COLUMNS = [
  { key: "nama", required: true },
  { key: "tempat_lahir", required: true },
  { key: "tanggal_lahir", required: true },
  { key: "jenis_kelamin", required: true },
  { key: "alamat", required: true },
  { key: "status_nikah", required: true },
  { key: "pekerjaan", required: true },
  { key: "no_hp", required: false },
  { key: "email", required: false },
  { key: "status", required: false },
  { key: "tanggal_masuk", required: false },
  { key: "tanggal_keluar", required: false },
  { key: "grup", required: false },
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

export type ColumnMatch = {
  /** Position of each column found in the file. */
  indexes: Partial<Record<ImportColumnKey, number>>;
  /** Required columns the file lacks; any entry fails the file. */
  missing: ImportColumnKey[];
  /** Columns that appear more than once; any entry fails the file, since either copy could be the right one. */
  repeated: ImportColumnKey[];
  /** Unknown headers, as written in the file, for the preview to name. */
  ignored: string[];
};

const KNOWN_KEYS = new Set<string>(IMPORT_COLUMNS.map((column) => column.key));
const isKnownKey = (key: string): key is ImportColumnKey => KNOWN_KEYS.has(key);

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/[\s_]+/g, "_");

export function matchColumns(headers: readonly string[]): ColumnMatch {
  const indexes: ColumnMatch["indexes"] = {};
  const repeated = new Set<ImportColumnKey>();
  const ignored: string[] = [];

  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key) return;
    if (!isKnownKey(key)) ignored.push(header.trim());
    else if (indexes[key] === undefined) indexes[key] = index;
    else repeated.add(key);
  });

  const missing = IMPORT_COLUMNS.filter((column) => column.required && indexes[column.key] === undefined).map(
    (column) => column.key,
  );
  return { indexes, missing, repeated: [...repeated], ignored };
}
