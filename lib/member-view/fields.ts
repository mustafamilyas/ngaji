import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";

/**
 * Whitelist of what a member view may filter, sort and group on. Anything not
 * listed here (phone, address, email) is unreachable by construction — the
 * definition schema and query builder only accept keys from this registry.
 * Other data sources later get their own registry keyed by `ViewSource`.
 */
export type FieldType = "text" | "choice" | "date" | "nullableDate" | "age" | "group";

const DATE_OPERATORS = ["before", "onOrBefore", "after", "onOrAfter", "between", "withinLastDays"] as const;

export const OPERATORS_BY_TYPE = {
  text: ["contains", "equals"],
  choice: ["isAnyOf", "isNoneOf"],
  date: DATE_OPERATORS,
  nullableDate: [...DATE_OPERATORS, "isEmpty", "isNotEmpty"],
  age: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  group: ["inSubtreeOf"],
} as const satisfies Record<FieldType, readonly string[]>;

export type Operator = (typeof OPERATORS_BY_TYPE)[FieldType][number];

type FieldDef = {
  label: string;
  type: FieldType;
  /** Enum values for `choice` fields. */
  values?: readonly string[];
  sortable: boolean;
  groupable: boolean;
};

export const MEMBER_VIEW_FIELDS = {
  name: { label: "Nama", type: "text", sortable: true, groupable: false },
  birthPlace: { label: "Tempat lahir", type: "text", sortable: true, groupable: false },
  sex: { label: "Jenis kelamin", type: "choice", values: SEXES, sortable: true, groupable: true },
  status: { label: "Status", type: "choice", values: MEMBER_STATUSES, sortable: true, groupable: true },
  maritalStatus: { label: "Status nikah", type: "choice", values: MARITAL_STATUSES, sortable: true, groupable: true },
  workStatus: { label: "Pekerjaan", type: "choice", values: WORK_STATUSES, sortable: true, groupable: true },
  birthDate: { label: "Tanggal lahir", type: "date", sortable: true, groupable: false },
  joinedAt: { label: "Tanggal masuk", type: "date", sortable: true, groupable: false },
  exitedAt: { label: "Tanggal keluar", type: "nullableDate", sortable: true, groupable: false },
  age: { label: "Usia", type: "age", sortable: true, groupable: false },
  group: { label: "Grup", type: "group", sortable: true, groupable: false },
} as const satisfies Record<string, FieldDef>;

export type FieldKey = keyof typeof MEMBER_VIEW_FIELDS;

export const RULE_FIELD_KEYS = Object.keys(MEMBER_VIEW_FIELDS) as FieldKey[];

export const SORT_FIELD_KEYS = RULE_FIELD_KEYS.filter((k) => MEMBER_VIEW_FIELDS[k].sortable);
export type SortField = (typeof SORT_FIELD_KEYS)[number];

export const GROUPABLE_FIELDS = RULE_FIELD_KEYS.filter((k) => MEMBER_VIEW_FIELDS[k].groupable) as ("sex" | "status" | "maritalStatus" | "workStatus")[];

export function isRuleField(value: string): value is FieldKey {
  return Object.hasOwn(MEMBER_VIEW_FIELDS, value);
}

export function isSortField(value: string): value is SortField {
  return isRuleField(value) && MEMBER_VIEW_FIELDS[value].sortable;
}

export function isGroupable(value: string): value is (typeof GROUPABLE_FIELDS)[number] {
  return isRuleField(value) && MEMBER_VIEW_FIELDS[value].groupable;
}

export function operatorsFor(field: FieldKey): readonly Operator[] {
  return OPERATORS_BY_TYPE[MEMBER_VIEW_FIELDS[field].type];
}
