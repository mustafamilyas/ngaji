import { VIEW_MAX_SUMMARIES } from "@/lib/constants";
import type { Definition } from "@/lib/validation/member-view";
import type { Dimension } from "@/lib/validation/summary";
import { ageBucketsFromBrackets } from "./edit";
import type { LevelOption, TagOption } from "./editor-options";
import { GROUPABLE_FIELDS, MEMBER_VIEW_FIELDS, isGroupable } from "./fields";

/**
 * Pure helpers behind the "Ringkasan" part of the "Tampilan" menu: immutable
 * edits of `definition.summaries` and the select values for choosing a
 * dimension. Like the other editor helpers nothing here is trusted by the
 * server — every edited definition is re-validated on load and save.
 */

const NEW_SUMMARY: Dimension = { kind: "property", field: "sex" };

function withSummaries(definition: Definition, summaries: NonNullable<Definition["summaries"]>): Definition {
  const { summaries: _old, ...rest } = definition;
  void _old;
  return summaries.length > 0 ? { ...rest, summaries } : rest;
}

export function addSummary(definition: Definition): Definition {
  const current = definition.summaries ?? [];
  if (current.length >= VIEW_MAX_SUMMARIES) return definition;
  return withSummaries(definition, [...current, { dimension: { ...NEW_SUMMARY } }]);
}

export function removeSummary(definition: Definition, index: number): Definition {
  return withSummaries(definition, (definition.summaries ?? []).filter((_, i) => i !== index));
}

/** `direction` -1 = up, 1 = down; a move past either end returns the same definition. */
export function moveSummary(definition: Definition, index: number, direction: -1 | 1): Definition {
  const current = definition.summaries ?? [];
  const target = index + direction;
  if (index < 0 || index >= current.length || target < 0 || target >= current.length) return definition;
  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  return withSummaries(definition, next);
}

export function replaceSummaryDimension(definition: Definition, index: number, dimension: Dimension): Definition {
  return withSummaries(
    definition,
    (definition.summaries ?? []).map((s, i) => (i === index ? { ...s, dimension } : s)),
  );
}

// ---- Dimension <-> select value ----

/** `p:<field>`, `age`, `l:<depth>`, `k:<tag id>` (tag key, by anchor) or `t:<tag id>` (simple tag). */
export function choiceOfDimension(dimension: Dimension): string {
  switch (dimension.kind) {
    case "property":
      return `p:${dimension.field}`;
    case "ageBuckets":
      return "age";
    case "groupLevel":
      return `l:${dimension.depth}`;
    case "tagKey":
      return `k:${dimension.tagId}`;
    case "tag":
      return `t:${dimension.tagId}`;
  }
}

const positiveInt = (text: string): number | null => (/^[1-9]\d*$/.test(text) ? Number(text) : null);

/** `null` for anything `choiceOfDimension` could not have produced. Age buckets start from the standard brackets. */
export function dimensionOfChoice(value: string): Dimension | null {
  if (value === "age") return { kind: "ageBuckets", buckets: ageBucketsFromBrackets() };
  const [prefix, rest = ""] = [value.slice(0, 2), value.slice(2)];
  switch (prefix) {
    case "p:":
      return isGroupable(rest) ? { kind: "property", field: rest } : null;
    case "l:": {
      const depth = /^\d+$/.test(rest) ? Number(rest) : null;
      return depth === null ? null : { kind: "groupLevel", depth };
    }
    case "k:": {
      const tagId = positiveInt(rest);
      return tagId === null ? null : { kind: "tagKey", tagId };
    }
    case "t:": {
      const tagId = positiveInt(rest);
      return tagId === null ? null : { kind: "tag", tagId };
    }
    default:
      return null;
  }
}

export type SummaryChoice = { value: string; label: string };

/**
 * What a summary can count by, in menu order: member properties, age, org
 * levels, then tags — one entry per key (anchored on its lowest value id) and
 * per owner group, plus each simple tag.
 */
export function summaryChoices(levels: readonly LevelOption[], tags: readonly TagOption[]): SummaryChoice[] {
  const choices: SummaryChoice[] = GROUPABLE_FIELDS.map((field) => ({ value: `p:${field}`, label: MEMBER_VIEW_FIELDS[field].label }));
  choices.push({ value: "age", label: MEMBER_VIEW_FIELDS.age.label });
  for (const level of levels) choices.push({ value: `l:${level.depth}`, label: `Tingkat ${level.name}` });

  const anchors = new Map<string, TagOption>();
  for (const tag of tags) {
    if (tag.value === null) continue;
    const id = `${tag.groupId}:${tag.key}`;
    const known = anchors.get(id);
    if (!known || tag.id < known.id) anchors.set(id, tag);
  }
  [...anchors.values()]
    .sort((a, b) => a.key.localeCompare(b.key, "id") || a.groupId - b.groupId)
    .forEach((tag) => choices.push({ value: `k:${tag.id}`, label: `Tag: ${tag.key}` }));
  tags
    .filter((tag) => tag.value === null)
    .sort((a, b) => a.key.localeCompare(b.key, "id") || a.id - b.id)
    .forEach((tag) => choices.push({ value: `t:${tag.id}`, label: `Tag: ${tag.key}` }));
  return choices;
}

/** Select value to show for `dimension`: a tag key maps to its anchor entry in `summaryChoices`, whichever value it was saved on. */
export function choiceShownFor(dimension: Dimension, tags: readonly TagOption[]): string {
  if (dimension.kind !== "tagKey") return choiceOfDimension(dimension);
  const saved = tags.find((t) => t.id === dimension.tagId);
  if (!saved) return choiceOfDimension(dimension);
  const sameKey = tags.filter((t) => t.value !== null && t.groupId === saved.groupId && t.key === saved.key);
  return `k:${Math.min(...sameKey.map((t) => t.id))}`;
}
