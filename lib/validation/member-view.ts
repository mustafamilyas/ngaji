import { z } from "zod";
import {
  VIEW_MAX_AGE,
  VIEW_MAX_GROUP_IDS,
  VIEW_MAX_RULES_PER_GROUP,
  VIEW_MAX_RULE_GROUPS,
  VIEW_MAX_TEXT_VALUE_LENGTH,
  VIEW_MAX_WITHIN_DAYS,
  MAX_NAME_LENGTH,
  MAX_TAG_FILTER_IDS,
} from "@/lib/constants";
import { isDateString } from "@/lib/dates";
import { VIEW_SOURCES, VIEW_VISIBILITIES } from "@/lib/validation/enums";
import { MEMBER_VIEW_FIELDS, RULE_FIELD_KEYS, SORT_FIELD_KEYS, operatorsFor, type FieldKey, type Operator } from "@/lib/member-view/fields";
import { ageBucketsDimensionSchema, groupLevelDimensionSchema, propertyDimensionSchema } from "@/lib/validation/summary";
import { DEFAULT_MEMBER_COLUMNS, MEMBER_COLUMNS, isMemberColumnKey, type MemberColumnKey } from "@/lib/member/columns";

/**
 * Member view definition (member-view-query spec), shared by the save action,
 * saved-view loading and `?d=` URL drafts. Strict parsing (`definitionSchema`)
 * rejects anything wrong; lenient parsing (`parseDefinitionLenient`) drops
 * what it cannot read and reports warnings, so stale views still open.
 */

export const viewNameSchema = z.string().trim().min(1, "Nama wajib diisi").max(MAX_NAME_LENGTH, "Nama terlalu panjang");

const conjunctionSchema = z.enum(["AND", "OR"]);
export type Conjunction = z.infer<typeof conjunctionSchema>;

// ---- Rules ----

export type Rule = { field: FieldKey; operator: Operator; value?: unknown };

type ValueResult = { ok: true; value: unknown } | { ok: false; message: string };
const ok = (value: unknown): ValueResult => ({ ok: true, value });
const fail = (message: string): ValueResult => ({ ok: false, message });

const dateValue = z.string().refine((v) => isDateString(v), "Tanggal tidak valid");
const ageValue = z.number().int().min(0).max(VIEW_MAX_AGE);
const positiveInt = z.number().int().positive();

function parsed(schema: z.ZodType, value: unknown, message: string): ValueResult {
  const result = schema.safeParse(value);
  return result.success ? ok(result.data) : fail(message);
}

function pair(schema: z.ZodType<string> | z.ZodType<number>, value: unknown): ValueResult {
  const result = z.tuple([schema, schema]).safeParse(value);
  if (!result.success) return fail("Rentang tidak valid");
  const [a, b] = result.data as [string | number, string | number];
  return a <= b ? ok([a, b]) : fail("Rentang tidak valid");
}

/** Validates (and normalizes) a rule's `value` for its field and operator. */
function parseRuleValue(field: FieldKey, operator: Operator, value: unknown): ValueResult {
  const def = MEMBER_VIEW_FIELDS[field];
  switch (def.type) {
    case "text":
      return parsed(z.string().trim().min(1).max(VIEW_MAX_TEXT_VALUE_LENGTH), value, "Nilai tidak valid");
    case "choice": {
      const values = def.values as readonly string[];
      const schema = z.array(z.string().refine((v) => values.includes(v))).min(1).max(values.length);
      const result = schema.safeParse(value);
      if (!result.success || new Set(result.data).size !== result.data.length) return fail("Pilihan tidak valid");
      return ok(result.data);
    }
    case "date":
    case "nullableDate":
      if (operator === "isEmpty" || operator === "isNotEmpty") return value === undefined ? ok(undefined) : fail("Nilai tidak diperlukan");
      if (operator === "between") return pair(dateValue, value);
      if (operator === "withinLastDays") return parsed(z.number().int().min(1).max(VIEW_MAX_WITHIN_DAYS), value, "Jumlah hari tidak valid");
      return parsed(dateValue, value, "Tanggal tidak valid");
    case "age":
      return operator === "between" ? pair(ageValue, value) : parsed(ageValue, value, "Usia tidak valid");
    case "group": {
      const result = z.array(positiveInt).min(1).max(VIEW_MAX_GROUP_IDS).safeParse(value);
      if (!result.success || new Set(result.data).size !== result.data.length) return fail("Grup tidak valid");
      return ok(result.data);
    }
    case "tag": {
      const result = z.array(positiveInt).min(1).max(MAX_TAG_FILTER_IDS).safeParse(value);
      if (!result.success || new Set(result.data).size !== result.data.length) return fail("Tag tidak valid");
      return ok(result.data);
    }
  }
}

export const ruleSchema = z
  .object({
    field: z.enum(RULE_FIELD_KEYS as [FieldKey, ...FieldKey[]]),
    operator: z.string(),
    value: z.unknown().optional(),
  })
  .strict()
  .transform((rule, ctx): Rule => {
    const allowed = operatorsFor(rule.field) as readonly string[];
    if (!allowed.includes(rule.operator)) {
      ctx.addIssue({ code: "custom", message: "Operator tidak berlaku untuk kolom ini", path: ["operator"] });
      return z.NEVER;
    }
    const result = parseRuleValue(rule.field, rule.operator as Operator, rule.value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message, path: ["value"] });
      return z.NEVER;
    }
    return result.value === undefined
      ? { field: rule.field, operator: rule.operator as Operator }
      : { field: rule.field, operator: rule.operator as Operator, value: result.value };
  });

export const ruleGroupSchema = z
  .object({ op: conjunctionSchema, rules: z.array(ruleSchema).min(1).max(VIEW_MAX_RULES_PER_GROUP) })
  .strict();
export type RuleGroup = z.infer<typeof ruleGroupSchema>;

export const filterSchema = z
  .object({ op: conjunctionSchema, groups: z.array(ruleGroupSchema).max(VIEW_MAX_RULE_GROUPS) })
  .strict();
export type Filter = z.infer<typeof filterSchema>;

// ---- Sort, group by, columns ----

export const sortSchema = z
  .object({ field: z.enum(SORT_FIELD_KEYS as [(typeof SORT_FIELD_KEYS)[number], ...(typeof SORT_FIELD_KEYS)[number][]]), dir: z.enum(["asc", "desc"]) })
  .strict();
export type ViewSort = z.infer<typeof sortSchema>;

export const groupBySchema = z.discriminatedUnion("kind", [propertyDimensionSchema, groupLevelDimensionSchema, ageBucketsDimensionSchema]);
export type GroupBy = z.infer<typeof groupBySchema>;

/** Known column keys, unique, normalized to table order. */
export const columnsSchema = z
  .array(z.string().refine(isMemberColumnKey, "Kolom tidak dikenal"))
  .max(MEMBER_COLUMNS.length)
  .refine((keys) => new Set(keys).size === keys.length, "Kolom ganda")
  .transform((keys) => MEMBER_COLUMNS.map((c) => c.key).filter((k) => keys.includes(k)) as MemberColumnKey[]);

// ---- Definition ----

export const definitionSchema = z
  .object({
    version: z.literal(1),
    filter: filterSchema,
    sort: sortSchema,
    groupBy: groupBySchema.optional(),
    columns: columnsSchema,
  })
  .strict();
export type Definition = z.infer<typeof definitionSchema>;

export const DEFAULT_SORT: ViewSort = { field: "name", dir: "asc" };

/** No rules, name order, no grouping, default `/dashboard/anggota` columns. */
export function emptyDefinition(): Definition {
  return { version: 1, filter: { op: "AND", groups: [] }, sort: { ...DEFAULT_SORT }, columns: [...DEFAULT_MEMBER_COLUMNS] };
}

/** Starting point of `/dashboard/tampilan/baru`: active members only. */
export function newViewDefinition(): Definition {
  return {
    ...emptyDefinition(),
    filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "status", operator: "isAnyOf", value: ["AKTIF"] }] }] },
  };
}

// ---- Lenient parsing ----

export type DefinitionWarning =
  | "definition_invalid"
  | "filter_invalid"
  | "group_invalid"
  | "rule_invalid"
  | "limit_exceeded"
  | "sort_invalid"
  | "group_by_invalid"
  | "columns_invalid";

export type LenientResult = { definition: Definition; warnings: DefinitionWarning[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a stored or URL-supplied definition, dropping invalid rules, sort,
 * grouping and columns one by one. Never throws; an unreadable root yields the
 * empty definition. Group IDs are checked later against the DB.
 */
export function parseDefinitionLenient(input: unknown): LenientResult {
  const warnings = new Set<DefinitionWarning>();
  const warn = (w: DefinitionWarning) => void warnings.add(w);

  if (!isRecord(input) || input.version !== 1) {
    return { definition: emptyDefinition(), warnings: ["definition_invalid"] };
  }
  const definition = emptyDefinition();

  if (input.filter !== undefined) {
    if (!isRecord(input.filter) || !conjunctionSchema.safeParse(input.filter.op).success || !Array.isArray(input.filter.groups)) {
      warn("filter_invalid");
    } else {
      definition.filter.op = input.filter.op as Conjunction;
      for (const rawGroup of input.filter.groups) {
        if (definition.filter.groups.length >= VIEW_MAX_RULE_GROUPS) {
          warn("limit_exceeded");
          break;
        }
        if (!isRecord(rawGroup) || !conjunctionSchema.safeParse(rawGroup.op).success || !Array.isArray(rawGroup.rules)) {
          warn("group_invalid");
          continue;
        }
        const rules: Rule[] = [];
        for (const rawRule of rawGroup.rules) {
          if (rules.length >= VIEW_MAX_RULES_PER_GROUP) {
            warn("limit_exceeded");
            break;
          }
          const rule = ruleSchema.safeParse(rawRule);
          if (rule.success) rules.push(rule.data);
          else warn("rule_invalid");
        }
        if (rules.length > 0) definition.filter.groups.push({ op: rawGroup.op as Conjunction, rules });
      }
    }
  }

  if (input.sort !== undefined) {
    const sort = sortSchema.safeParse(input.sort);
    if (sort.success) definition.sort = sort.data;
    else warn("sort_invalid");
  }

  if (input.groupBy !== undefined) {
    const groupBy = groupBySchema.safeParse(input.groupBy);
    if (groupBy.success) definition.groupBy = groupBy.data;
    else warn("group_by_invalid");
  }

  if (input.columns !== undefined) {
    if (!Array.isArray(input.columns)) {
      warn("columns_invalid");
    } else {
      const known = input.columns.filter((c): c is MemberColumnKey => typeof c === "string" && isMemberColumnKey(c));
      if (known.length !== input.columns.length) warn("columns_invalid");
      definition.columns = columnsSchema.parse([...new Set(known)]);
    }
  }

  return { definition, warnings: [...warnings] };
}

// ---- Mutation inputs ----

const viewIdSchema = z.coerce.number().int().positive();

/** `groupId` is deliberately absent: the owning group always comes from the session. */
export const createMemberViewSchema = z.object({
  name: viewNameSchema,
  definition: definitionSchema,
  source: z.enum(VIEW_SOURCES).default("member"),
  visibility: z.enum(VIEW_VISIBILITIES).default("GROUP"),
});
export type CreateMemberViewInput = z.infer<typeof createMemberViewSchema>;

export const updateMemberViewSchema = z
  .object({
    viewId: viewIdSchema,
    name: viewNameSchema.optional(),
    definition: definitionSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.definition !== undefined, {
    message: "Tidak ada perubahan",
  });
export type UpdateMemberViewInput = z.infer<typeof updateMemberViewSchema>;

export const memberViewIdSchema = z.object({ viewId: viewIdSchema });
export type MemberViewIdInput = z.infer<typeof memberViewIdSchema>;
