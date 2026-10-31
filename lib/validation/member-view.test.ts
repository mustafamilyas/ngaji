import { describe, expect, it } from "vitest";
import { MAX_TAG_FILTER_IDS, VIEW_MAX_AGE_BUCKETS, VIEW_MAX_RULES_PER_GROUP, VIEW_MAX_RULE_GROUPS } from "@/lib/constants";
import { DEFAULT_MEMBER_COLUMNS } from "@/lib/member/columns";
import { definitionSchema, emptyDefinition, newViewDefinition, parseDefinitionLenient, ruleSchema, viewNameSchema } from "./member-view";

const rule = (field: string, operator: string, value?: unknown) => ({ field, operator, ...(value === undefined ? {} : { value }) });
const withFilter = (groups: unknown[], op = "AND") => ({ ...emptyDefinition(), filter: { op, groups } });
const group = (rules: unknown[], op = "AND") => ({ op, rules });

describe("Definition shape", () => {
  it("accepts AND of OR groups", () => {
    const def = withFilter([
      group([rule("sex", "isAnyOf", ["L"]), rule("sex", "isAnyOf", ["P"])], "OR"),
      group([rule("age", "gte", 13), rule("age", "lte", 17)]),
    ]);
    expect(definitionSchema.safeParse(def).success).toBe(true);
  });

  it("accepts OR of AND groups", () => {
    const def = withFilter(
      [group([rule("age", "lte", 12), rule("sex", "isAnyOf", ["P"])]), group([rule("status", "isAnyOf", ["PINDAH"])])],
      "OR",
    );
    expect(definitionSchema.safeParse(def).success).toBe(true);
  });

  it("accepts an empty filter", () => {
    expect(definitionSchema.safeParse(emptyDefinition()).success).toBe(true);
  });

  it("rejects a nested rule group", () => {
    const def = withFilter([group([group([rule("age", "gte", 13)])])]);
    expect(definitionSchema.safeParse(def).success).toBe(false);
  });

  it("rejects too many rules in a group", () => {
    const rules = Array.from({ length: VIEW_MAX_RULES_PER_GROUP + 1 }, () => rule("age", "gte", 1));
    expect(definitionSchema.safeParse(withFilter([group(rules)])).success).toBe(false);
  });

  it("rejects too many rule groups and empty groups", () => {
    const groups = Array.from({ length: VIEW_MAX_RULE_GROUPS + 1 }, () => group([rule("age", "gte", 1)]));
    expect(definitionSchema.safeParse(withFilter(groups)).success).toBe(false);
    expect(definitionSchema.safeParse(withFilter([group([])])).success).toBe(false);
  });

  it("rejects unknown keys and other versions", () => {
    expect(definitionSchema.safeParse({ ...emptyDefinition(), extra: 1 }).success).toBe(false);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), version: 2 }).success).toBe(false);
    expect(ruleSchema.safeParse({ ...rule("age", "gte", 1), extra: 1 }).success).toBe(false);
  });
});

describe("Fields and operators", () => {
  it("rejects an operator not allowed for the field", () => {
    expect(ruleSchema.safeParse(rule("sex", "gt", "L")).success).toBe(false);
    expect(ruleSchema.safeParse(rule("name", "isAnyOf", ["a"])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("birthDate", "isEmpty")).success).toBe(false);
  });

  it("rejects an invalid enum value", () => {
    expect(ruleSchema.safeParse(rule("status", "isAnyOf", ["HILANG"])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("status", "isAnyOf", [])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("status", "isAnyOf", ["AKTIF", "AKTIF"])).success).toBe(false);
  });

  it("accepts exitedAt is empty / is not empty without a value", () => {
    expect(ruleSchema.safeParse(rule("exitedAt", "isEmpty")).success).toBe(true);
    expect(ruleSchema.safeParse(rule("exitedAt", "isNotEmpty")).success).toBe(true);
    expect(ruleSchema.safeParse(rule("exitedAt", "isEmpty", "x")).success).toBe(false);
  });

  it("checks value shapes", () => {
    expect(ruleSchema.safeParse(rule("joinedAt", "withinLastDays", 30)).success).toBe(true);
    expect(ruleSchema.safeParse(rule("joinedAt", "withinLastDays", 0)).success).toBe(false);
    expect(ruleSchema.safeParse(rule("joinedAt", "withinLastDays", "30")).success).toBe(false);
    expect(ruleSchema.safeParse(rule("joinedAt", "before", "2026-02-30")).success).toBe(false);
    expect(ruleSchema.safeParse(rule("birthDate", "between", ["2000-01-01", "2010-01-01"])).success).toBe(true);
    expect(ruleSchema.safeParse(rule("birthDate", "between", ["2010-01-01", "2000-01-01"])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("age", "between", [13, 17])).success).toBe(true);
    expect(ruleSchema.safeParse(rule("age", "between", [17, 13])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("age", "gte", -1)).success).toBe(false);
    expect(ruleSchema.safeParse(rule("age", "gte", 1.5)).success).toBe(false);
    expect(ruleSchema.safeParse(rule("group", "inSubtreeOf", [3, 4])).success).toBe(true);
    expect(ruleSchema.safeParse(rule("group", "inSubtreeOf", [])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("group", "inSubtreeOf", [0])).success).toBe(false);
  });

  it("trims text values and rejects blank ones", () => {
    expect(ruleSchema.parse(rule("name", "contains", "  ali  "))).toEqual(rule("name", "contains", "ali"));
    expect(ruleSchema.safeParse(rule("name", "contains", "   ")).success).toBe(false);
  });
});

describe("Tag rule", () => {
  it("accepts has any of / has none of with 1..MAX_TAG_FILTER_IDS unique positive ids", () => {
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", [3, 5])).success).toBe(true);
    expect(ruleSchema.safeParse(rule("tag", "hasNoneOf", [3])).success).toBe(true);
    const max = Array.from({ length: MAX_TAG_FILTER_IDS }, (_, i) => i + 1);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", max)).success).toBe(true);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", [...max, MAX_TAG_FILTER_IDS + 1])).success).toBe(false);
  });

  it("rejects other operators, bad values and a missing value", () => {
    expect(ruleSchema.safeParse(rule("tag", "isAnyOf", [3])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "contains", "x")).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf")).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", [])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", [3, 3])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", [0])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", [1.5])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", ["3"])).success).toBe(false);
    expect(ruleSchema.safeParse(rule("tag", "hasAnyOf", 3)).success).toBe(false);
  });

  it("rejects sort and group-by on tag", () => {
    expect(definitionSchema.safeParse({ ...emptyDefinition(), sort: { field: "tag", dir: "asc" } }).success).toBe(false);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), groupBy: { kind: "property", field: "tag" } }).success).toBe(false);
  });

  it("falls back to the default sort for a draft sorting by tag", () => {
    const result = parseDefinitionLenient({ ...emptyDefinition(), sort: { field: "tag", dir: "asc" } });
    expect(result.definition.sort).toEqual({ field: "name", dir: "asc" });
    expect(result.warnings).toContain("sort_invalid");
  });
});

describe("PII fields", () => {
  it("rejects rules, sort and group-by on phone, address and email", () => {
    for (const field of ["phone", "address", "email"]) {
      expect(ruleSchema.safeParse(rule(field, "contains", "x")).success).toBe(false);
      expect(definitionSchema.safeParse({ ...emptyDefinition(), sort: { field, dir: "asc" } }).success).toBe(false);
      expect(definitionSchema.safeParse({ ...emptyDefinition(), groupBy: { kind: "property", field } }).success).toBe(false);
    }
  });

  it("ignores them leniently with warnings and the default sort", () => {
    const result = parseDefinitionLenient({
      ...withFilter([group([rule("phone", "contains", "08"), rule("age", "gte", 13)])]),
      sort: { field: "address", dir: "desc" },
    });
    expect(result.definition.filter.groups).toEqual([group([rule("age", "gte", 13)])]);
    expect(result.definition.sort).toEqual({ field: "name", dir: "asc" });
    expect(result.warnings).toEqual(expect.arrayContaining(["rule_invalid", "sort_invalid"]));
  });
});

describe("Group by", () => {
  const buckets = (b: unknown[]) => ({ ...emptyDefinition(), groupBy: { kind: "ageBuckets", buckets: b } });

  it("accepts non-overlapping buckets, in any order", () => {
    const def = buckets([{ label: "Pemuda", min: 18, max: 30 }, { label: "Remaja", min: 13, max: 17 }, { label: "Lansia", min: 60, max: null }]);
    expect(definitionSchema.safeParse(def).success).toBe(true);
  });

  it("rejects overlapping buckets", () => {
    expect(definitionSchema.safeParse(buckets([{ label: "A", min: 13, max: 17 }, { label: "B", min: 17, max: 25 }])).success).toBe(false);
    expect(definitionSchema.safeParse(buckets([{ label: "A", min: 13, max: null }, { label: "B", min: 20, max: 25 }])).success).toBe(false);
  });

  it("rejects bad bucket bounds, labels and counts", () => {
    expect(definitionSchema.safeParse(buckets([{ label: "A", min: 10, max: 5 }])).success).toBe(false);
    expect(definitionSchema.safeParse(buckets([{ label: " ", min: 1, max: 5 }])).success).toBe(false);
    expect(definitionSchema.safeParse(buckets([{ label: "x".repeat(51), min: 1, max: 5 }])).success).toBe(false);
    expect(definitionSchema.safeParse(buckets([])).success).toBe(false);
    const many = Array.from({ length: VIEW_MAX_AGE_BUCKETS + 1 }, (_, i) => ({ label: `B${i}`, min: i * 10, max: i * 10 + 9 }));
    expect(definitionSchema.safeParse(buckets(many)).success).toBe(false);
  });

  it("accepts property and org-level grouping only with valid values", () => {
    expect(definitionSchema.safeParse({ ...emptyDefinition(), groupBy: { kind: "property", field: "status" } }).success).toBe(true);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), groupBy: { kind: "property", field: "age" } }).success).toBe(false);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), groupBy: { kind: "groupLevel", depth: 2 } }).success).toBe(true);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), groupBy: { kind: "groupLevel", depth: -1 } }).success).toBe(false);
  });
});

describe("Columns", () => {
  it("normalizes to table order and rejects unknown or duplicate keys", () => {
    expect(definitionSchema.parse({ ...emptyDefinition(), columns: ["hp", "grup"] }).columns).toEqual(["grup", "hp"]);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), columns: ["bogus"] }).success).toBe(false);
    expect(definitionSchema.safeParse({ ...emptyDefinition(), columns: ["hp", "hp"] }).success).toBe(false);
  });

  it("allows name-only (empty columns)", () => {
    expect(definitionSchema.safeParse({ ...emptyDefinition(), columns: [] }).success).toBe(true);
  });
});

describe("parseDefinitionLenient", () => {
  it("returns a valid definition without warnings unchanged", () => {
    const def = newViewDefinition();
    expect(parseDefinitionLenient(def)).toEqual({ definition: def, warnings: [] });
  });

  it("falls back to the empty definition for unreadable input", () => {
    for (const input of [null, "x", 5, [], { version: 2 }]) {
      expect(parseDefinitionLenient(input)).toEqual({ definition: emptyDefinition(), warnings: ["definition_invalid"] });
    }
  });

  it("drops invalid rules and groups left empty, keeping the rest", () => {
    const result = parseDefinitionLenient(
      withFilter([group([rule("sex", "gt", "L")]), group([rule("age", "gte", 13), rule("status", "isAnyOf", ["HILANG"])], "OR")]),
    );
    expect(result.definition.filter.groups).toEqual([group([rule("age", "gte", 13)], "OR")]);
    expect(result.warnings).toEqual(["rule_invalid"]);
  });

  it("drops invalid sort, group-by and unknown columns", () => {
    const result = parseDefinitionLenient({
      ...emptyDefinition(),
      sort: { field: "nope", dir: "asc" },
      groupBy: { kind: "property", field: "email" },
      columns: ["hp", "bogus", "hp"],
    });
    expect(result.definition.sort).toEqual({ field: "name", dir: "asc" });
    expect(result.definition.groupBy).toBeUndefined();
    expect(result.definition.columns).toEqual(["hp"]);
    expect(result.warnings.sort()).toEqual(["columns_invalid", "group_by_invalid", "sort_invalid"]);
  });

  it("uses defaults for absent parts without warnings", () => {
    const result = parseDefinitionLenient({ version: 1 });
    expect(result).toEqual({ definition: emptyDefinition(), warnings: [] });
    expect(result.definition.columns).toEqual(DEFAULT_MEMBER_COLUMNS);
  });

  it("caps over-limit input and warns instead of throwing", () => {
    const groups = Array.from({ length: VIEW_MAX_RULE_GROUPS + 2 }, () => group([rule("age", "gte", 1)]));
    const result = parseDefinitionLenient(withFilter(groups));
    expect(result.definition.filter.groups).toHaveLength(VIEW_MAX_RULE_GROUPS);
    expect(result.warnings).toEqual(["limit_exceeded"]);
  });

  it("ignores a broken filter", () => {
    expect(parseDefinitionLenient({ version: 1, filter: "x" })).toEqual({ definition: emptyDefinition(), warnings: ["filter_invalid"] });
  });
});

describe("viewNameSchema", () => {
  it("trims and bounds the name", () => {
    expect(viewNameSchema.parse("  Remaja Aktif ")).toBe("Remaja Aktif");
    expect(viewNameSchema.safeParse("  ").success).toBe(false);
    expect(viewNameSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});
