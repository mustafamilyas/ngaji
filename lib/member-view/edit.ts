import { AGE_BRACKETS, VIEW_MAX_RULE_GROUPS } from "@/lib/constants";
import { formatEnumLabel, MEMBER_STATUS_LABELS, SEX_LABELS } from "@/lib/member/labels";
import type { Conjunction, Definition, GroupBy, Rule, RuleGroup } from "@/lib/validation/member-view";
import { MEMBER_VIEW_FIELDS, type FieldKey, type Operator } from "./fields";

/**
 * Pure helpers behind the filter bar and "Tampilan" menu: labels, rule
 * descriptions and immutable edits of a definition. Nothing here is trusted by
 * the server — every edited definition is re-parsed leniently on load.
 */

export const OPERATOR_LABELS: Record<Operator, string> = {
  contains: "mengandung",
  equals: "sama dengan",
  isAnyOf: "salah satu dari",
  isNoneOf: "bukan salah satu dari",
  before: "sebelum",
  onOrBefore: "pada atau sebelum",
  after: "setelah",
  onOrAfter: "pada atau setelah",
  between: "antara",
  withinLastDays: "dalam … hari terakhir",
  isEmpty: "kosong",
  isNotEmpty: "tidak kosong",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  inSubtreeOf: "berada di",
  hasAnyOf: "memiliki salah satu dari",
  hasNoneOf: "tidak memiliki satu pun dari",
};

/** Label of one choice value (`AKTIF` → "Aktif", `L` → "Laki-laki"). */
export function choiceLabel(field: FieldKey, value: string): string {
  if (field === "sex") return SEX_LABELS[value as keyof typeof SEX_LABELS] ?? value;
  if (field === "status") return MEMBER_STATUS_LABELS[value as keyof typeof MEMBER_STATUS_LABELS] ?? value;
  return formatEnumLabel(value);
}

/** One-line description of a rule for a filter chip. `groupLabels` maps group id → name, `tagLabels` tag id → "key" / "key:value". */
export function describeRule(rule: Rule, groupLabels: ReadonlyMap<number, string>, tagLabels: ReadonlyMap<number, string> = new Map()): string {
  const label = MEMBER_VIEW_FIELDS[rule.field].label;
  const operator = OPERATOR_LABELS[rule.operator];
  const value = rule.value;

  switch (MEMBER_VIEW_FIELDS[rule.field].type) {
    case "text":
      return `${label} ${operator} "${String(value)}"`;
    case "choice":
      return `${label} ${operator} ${(value as string[]).map((v) => choiceLabel(rule.field, v)).join(", ")}`;
    case "age":
      return rule.operator === "between"
        ? `${label} antara ${(value as number[])[0]} dan ${(value as number[])[1]}`
        : `${label} ${operator} ${String(value)}`;
    case "group":
      return `${label} ${operator} ${(value as number[]).map((id) => groupLabels.get(id) ?? "(grup tidak tersedia)").join(", ")}`;
    case "tag":
      return `${label} ${operator} ${(value as number[]).map((id) => tagLabels.get(id) ?? "(tag tidak tersedia)").join(", ")}`;
    case "date":
    case "nullableDate":
      if (rule.operator === "isEmpty" || rule.operator === "isNotEmpty") return `${label} ${operator}`;
      if (rule.operator === "between") return `${label} antara ${(value as string[])[0]} dan ${(value as string[])[1]}`;
      if (rule.operator === "withinLastDays") return `${label} dalam ${String(value)} hari terakhir`;
      return `${label} ${operator} ${String(value)}`;
  }
}

/**
 * Starting value when a rule's field or operator changes. Choice, age and
 * relative-date rules start valid so they apply at once; text and absolute-date
 * rules start empty and apply when the user fills them in.
 */
export function initialRuleValue(field: FieldKey, operator: Operator): unknown {
  if (operator === "isEmpty" || operator === "isNotEmpty") return undefined;
  const def = MEMBER_VIEW_FIELDS[field];
  switch (def.type) {
    case "text":
      return "";
    case "choice":
      return [def.values[0]];
    case "age":
      return operator === "between" ? [0, 17] : 0;
    case "group":
    case "tag":
      return [];
    case "date":
    case "nullableDate":
      if (operator === "withinLastDays") return 30;
      return operator === "between" ? ["", ""] : "";
  }
}

// ---- Definition edits (immutable) ----

export function setFilterOp(definition: Definition, op: Conjunction): Definition {
  return { ...definition, filter: { ...definition.filter, op } };
}

export function addRuleGroup(definition: Definition, rule: Rule): Definition {
  if (definition.filter.groups.length >= VIEW_MAX_RULE_GROUPS) return definition;
  return { ...definition, filter: { ...definition.filter, groups: [...definition.filter.groups, { op: "AND", rules: [rule] }] } };
}

export function replaceRuleGroup(definition: Definition, index: number, group: RuleGroup): Definition {
  const groups = definition.filter.groups.map((g, i) => (i === index ? group : g));
  return { ...definition, filter: { ...definition.filter, groups } };
}

export function removeRuleGroup(definition: Definition, index: number): Definition {
  return { ...definition, filter: { ...definition.filter, groups: definition.filter.groups.filter((_, i) => i !== index) } };
}

/** Age buckets seeded from `AGE_BRACKETS`, labels capitalized for display. */
export function ageBucketsFromBrackets(): Extract<GroupBy, { kind: "ageBuckets" }>["buckets"] {
  return AGE_BRACKETS.map((b) => ({ label: b.label.charAt(0).toUpperCase() + b.label.slice(1), min: b.min, max: b.max }));
}
