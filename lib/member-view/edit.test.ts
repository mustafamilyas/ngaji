import { describe, expect, it } from "vitest";
import { AGE_BRACKETS, VIEW_MAX_RULE_GROUPS } from "@/lib/constants";
import { emptyDefinition, groupBySchema, ruleSchema, type Rule } from "@/lib/validation/member-view";
import { MEMBER_VIEW_FIELDS, operatorsFor, type FieldKey } from "./fields";
import {
  addRuleGroup,
  ageBucketsFromBrackets,
  describeRule,
  initialRuleValue,
  removeRuleGroup,
  replaceRuleGroup,
  setFilterOp,
  OPERATOR_LABELS,
} from "./edit";

const labels = new Map([[7, "Desa Menteng"]]);

describe("describeRule", () => {
  it("describes each field type in Indonesian", () => {
    expect(describeRule({ field: "age", operator: "between", value: [13, 17] }, labels)).toBe("Usia antara 13 dan 17");
    expect(describeRule({ field: "age", operator: "gte", value: 17 }, labels)).toBe("Usia ≥ 17");
    expect(describeRule({ field: "status", operator: "isAnyOf", value: ["AKTIF", "PINDAH"] }, labels)).toBe(
      "Status salah satu dari Aktif, Pindah",
    );
    expect(describeRule({ field: "sex", operator: "isNoneOf", value: ["L"] }, labels)).toBe(
      "Jenis kelamin bukan salah satu dari Laki-laki",
    );
    expect(describeRule({ field: "name", operator: "contains", value: "ali" }, labels)).toBe('Nama mengandung "ali"');
    expect(describeRule({ field: "joinedAt", operator: "withinLastDays", value: 30 }, labels)).toBe(
      "Tanggal masuk dalam 30 hari terakhir",
    );
    expect(describeRule({ field: "exitedAt", operator: "isEmpty" }, labels)).toBe("Tanggal keluar kosong");
    expect(describeRule({ field: "group", operator: "inSubtreeOf", value: [7, 99] }, labels)).toBe(
      "Grup berada di Desa Menteng, (grup tidak tersedia)",
    );
  });

  it("describes tag rules with the tag labels, flagging unknown tags", () => {
    const tagLabels = new Map([[4, "fokus"], [5, "prioritas:tinggi"]]);
    expect(describeRule({ field: "tag", operator: "hasAnyOf", value: [4, 5] }, labels, tagLabels)).toBe(
      "Tag memiliki salah satu dari fokus, prioritas:tinggi",
    );
    expect(describeRule({ field: "tag", operator: "hasNoneOf", value: [4, 9] }, labels, tagLabels)).toBe(
      "Tag tidak memiliki satu pun dari fokus, (tag tidak tersedia)",
    );
  });
});

describe("initialRuleValue", () => {
  it("gives every field/operator pair a value of the right shape", () => {
    for (const field of Object.keys(MEMBER_VIEW_FIELDS) as FieldKey[]) {
      for (const operator of operatorsFor(field)) {
        const value = initialRuleValue(field, operator);
        const needsValue = operator !== "isEmpty" && operator !== "isNotEmpty";
        expect(value === undefined).toBe(!needsValue);
        expect(OPERATOR_LABELS[operator]).toBeTruthy();
      }
    }
  });

  it("is already valid for choice, age, and relative-date rules so adding one applies immediately", () => {
    const rule = (field: FieldKey, operator: string): Rule =>
      ({ field, operator, value: initialRuleValue(field, operator as never) }) as Rule;
    expect(ruleSchema.safeParse(rule("status", "isAnyOf")).success).toBe(true);
    expect(ruleSchema.safeParse(rule("age", "gte")).success).toBe(true);
    expect(ruleSchema.safeParse(rule("age", "between")).success).toBe(true);
    expect(ruleSchema.safeParse(rule("joinedAt", "withinLastDays")).success).toBe(true);
    expect(ruleSchema.safeParse(rule("exitedAt", "isEmpty")).success).toBe(true);
  });
});

describe("filter mutators", () => {
  const status: Rule = { field: "status", operator: "isAnyOf", value: ["AKTIF"] };

  it("adds, replaces and removes rule groups without mutating the input", () => {
    const base = emptyDefinition();
    const added = addRuleGroup(base, status);
    expect(base.filter.groups).toHaveLength(0);
    expect(added.filter.groups).toEqual([{ op: "AND", rules: [status] }]);

    const replaced = replaceRuleGroup(added, 0, { op: "OR", rules: [status, status] });
    expect(replaced.filter.groups[0].op).toBe("OR");

    expect(removeRuleGroup(replaced, 0).filter.groups).toHaveLength(0);
    expect(setFilterOp(base, "OR").filter.op).toBe("OR");
  });

  it("refuses to add past VIEW_MAX_RULE_GROUPS", () => {
    let def = emptyDefinition();
    for (let i = 0; i < VIEW_MAX_RULE_GROUPS + 2; i++) def = addRuleGroup(def, status);
    expect(def.filter.groups).toHaveLength(VIEW_MAX_RULE_GROUPS);
  });
});

describe("ageBucketsFromBrackets", () => {
  it("seeds valid, non-overlapping buckets from AGE_BRACKETS", () => {
    const buckets = ageBucketsFromBrackets();
    expect(buckets).toHaveLength(AGE_BRACKETS.length);
    expect(groupBySchema.safeParse({ kind: "ageBuckets", buckets }).success).toBe(true);
    expect(buckets[0].label).toBe("Balita");
  });
});
