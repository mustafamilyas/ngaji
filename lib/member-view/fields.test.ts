import { describe, expect, it } from "vitest";
import { MEMBER_COLUMNS } from "@/lib/member/columns";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import { GROUPABLE_FIELDS, MEMBER_VIEW_FIELDS, OPERATORS_BY_TYPE, RULE_FIELD_KEYS, SORT_FIELD_KEYS, isGroupable, isRuleField, isSortField } from "./fields";

const PII = ["phone", "address", "email", "hp", "alamat"];

describe("member view field registry", () => {
  it("never exposes PII fields in rules, sort or group-by", () => {
    for (const field of PII) {
      expect(RULE_FIELD_KEYS as readonly string[]).not.toContain(field);
      expect(SORT_FIELD_KEYS as readonly string[]).not.toContain(field);
      expect(GROUPABLE_FIELDS as readonly string[]).not.toContain(field);
      expect(isRuleField(field)).toBe(false);
      expect(isSortField(field)).toBe(false);
      expect(isGroupable(field)).toBe(false);
    }
  });

  it("lists the rule fields from the spec", () => {
    expect([...RULE_FIELD_KEYS].sort()).toEqual(
      ["age", "birthDate", "birthPlace", "exitedAt", "group", "joinedAt", "maritalStatus", "name", "sex", "status", "workStatus"].sort(),
    );
  });

  it("lists the sort keys from the spec", () => {
    expect([...SORT_FIELD_KEYS].sort()).toEqual(
      ["age", "birthDate", "birthPlace", "exitedAt", "group", "joinedAt", "maritalStatus", "name", "sex", "status", "workStatus"].sort(),
    );
  });

  it("allows grouping only by choice properties", () => {
    expect([...GROUPABLE_FIELDS].sort()).toEqual(["maritalStatus", "sex", "status", "workStatus"]);
  });

  it("gives each field the operators for its type", () => {
    expect(OPERATORS_BY_TYPE.text).toEqual(["contains", "equals"]);
    expect(OPERATORS_BY_TYPE.choice).toEqual(["isAnyOf", "isNoneOf"]);
    expect(OPERATORS_BY_TYPE.date).toEqual(["before", "onOrBefore", "after", "onOrAfter", "between", "withinLastDays"]);
    expect(OPERATORS_BY_TYPE.nullableDate).toEqual([...OPERATORS_BY_TYPE.date, "isEmpty", "isNotEmpty"]);
    expect(OPERATORS_BY_TYPE.age).toEqual(["eq", "neq", "gt", "gte", "lt", "lte", "between"]);
    expect(OPERATORS_BY_TYPE.group).toEqual(["inSubtreeOf"]);
    expect(MEMBER_VIEW_FIELDS.exitedAt.type).toBe("nullableDate");
    expect(MEMBER_VIEW_FIELDS.age.type).toBe("age");
  });

  it("uses the Member enum values for choice fields", () => {
    expect(MEMBER_VIEW_FIELDS.sex.values).toEqual(SEXES);
    expect(MEMBER_VIEW_FIELDS.status.values).toEqual(MEMBER_STATUSES);
    expect(MEMBER_VIEW_FIELDS.maritalStatus.values).toEqual(MARITAL_STATUSES);
    expect(MEMBER_VIEW_FIELDS.workStatus.values).toEqual(WORK_STATUSES);
  });

  it("does not collide with /anggota column keys for PII", () => {
    const columnKeys = MEMBER_COLUMNS.map((c) => c.key as string);
    expect(columnKeys).toContain("hp");
    expect(RULE_FIELD_KEYS as readonly string[]).not.toContain("hp");
  });
});
