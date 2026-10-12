import { describe, expect, it } from "vitest";
import { emptyDefinition, type Definition, type Rule } from "@/lib/validation/member-view";
import { buildOrderBy, buildWhere, ruleToWhere, type QueryContext } from "./query";

const ctx: QueryContext = {
  today: "2026-10-12",
  groupPaths: new Map([
    [3, "1/3/"],
    [7, "1/7/"],
  ]),
};
const def = (groups: Definition["filter"]["groups"], op: "AND" | "OR" = "AND"): Definition => ({ ...emptyDefinition(), filter: { op, groups } });
const r = (field: Rule["field"], operator: string, value?: unknown) => ({ field, operator, value }) as Rule;

describe("buildWhere", () => {
  it("is empty for an empty filter", () => {
    expect(buildWhere(emptyDefinition(), ctx)).toEqual({});
  });

  it("maps AND of OR groups", () => {
    const where = buildWhere(
      def([
        { op: "OR", rules: [r("sex", "isAnyOf", ["L"]), r("sex", "isAnyOf", ["P"])] },
        { op: "AND", rules: [r("age", "gte", 13), r("age", "lte", 17)] },
      ]),
      ctx,
    );
    expect(where).toEqual({
      AND: [
        { OR: [{ sex: { in: ["L"] } }, { sex: { in: ["P"] } }] },
        { AND: [{ birthDate: { lte: "2013-10-12" } }, { birthDate: { gt: "2008-10-12" } }] },
      ],
    });
  });

  it("maps OR of AND groups", () => {
    const where = buildWhere(def([{ op: "AND", rules: [r("name", "contains", "ali")] }, { op: "AND", rules: [r("status", "isNoneOf", ["KELUAR"])] }], "OR"), ctx);
    expect(where).toEqual({ OR: [{ AND: [{ name: { contains: "ali" } }] }, { AND: [{ status: { notIn: ["KELUAR"] } }] }] });
  });
});

describe("ruleToWhere", () => {
  it("handles text operators", () => {
    expect(ruleToWhere(r("birthPlace", "equals", "Bogor"), ctx)).toEqual({ birthPlace: { equals: "Bogor" } });
    expect(ruleToWhere(r("birthPlace", "contains", "bog"), ctx)).toEqual({ birthPlace: { contains: "bog" } });
  });

  it("handles date operators", () => {
    expect(ruleToWhere(r("birthDate", "before", "2000-01-01"), ctx)).toEqual({ birthDate: { lt: "2000-01-01" } });
    expect(ruleToWhere(r("birthDate", "onOrBefore", "2000-01-01"), ctx)).toEqual({ birthDate: { lte: "2000-01-01" } });
    expect(ruleToWhere(r("joinedAt", "after", "2000-01-01"), ctx)).toEqual({ joinedAt: { gt: "2000-01-01" } });
    expect(ruleToWhere(r("joinedAt", "onOrAfter", "2000-01-01"), ctx)).toEqual({ joinedAt: { gte: "2000-01-01" } });
    expect(ruleToWhere(r("joinedAt", "between", ["2000-01-01", "2000-02-01"]), ctx)).toEqual({ joinedAt: { gte: "2000-01-01", lte: "2000-02-01" } });
  });

  it("turns 'within the last N days' into a range ending today", () => {
    expect(ruleToWhere(r("joinedAt", "withinLastDays", 30), ctx)).toEqual({ joinedAt: { gte: "2026-09-12", lte: "2026-10-12" } });
  });

  it("handles exitedAt is empty / not empty", () => {
    expect(ruleToWhere(r("exitedAt", "isEmpty"), ctx)).toEqual({ exitedAt: { equals: null } });
    expect(ruleToWhere(r("exitedAt", "isNotEmpty"), ctx)).toEqual({ exitedAt: { not: null } });
  });

  it("turns age into birth-date bounds", () => {
    expect(ruleToWhere(r("age", "gte", 17), ctx)).toEqual({ birthDate: { lte: "2009-10-12" } });
    expect(ruleToWhere(r("age", "between", [13, 17]), ctx)).toEqual({ birthDate: { gt: "2008-10-12", lte: "2013-10-12" } });
    expect(ruleToWhere(r("age", "neq", 17), ctx)).toEqual({
      OR: [{ birthDate: { gt: "2009-10-12" } }, { birthDate: { lte: "2008-10-12" } }],
    });
  });

  it("matches group subtrees by path prefix", () => {
    expect(ruleToWhere(r("group", "inSubtreeOf", [3, 7]), ctx)).toEqual({
      OR: [{ group: { path: { startsWith: "1/3/" } } }, { group: { path: { startsWith: "1/7/" } } }],
    });
  });

  it("matches nothing when no group id resolves, never everything", () => {
    expect(ruleToWhere(r("group", "inSubtreeOf", [99]), ctx)).toEqual({ id: { in: [] } });
    expect(ruleToWhere(r("group", "inSubtreeOf", [99, 3]), ctx)).toEqual({ OR: [{ group: { path: { startsWith: "1/3/" } } }] });
  });
});

describe("buildOrderBy", () => {
  it("ends with name, then id", () => {
    expect(buildOrderBy({ field: "joinedAt", dir: "desc" })).toEqual([{ joinedAt: "desc" }, { name: "asc" }, { id: "asc" }]);
  });

  it("does not repeat name as its own tie-breaker", () => {
    expect(buildOrderBy({ field: "name", dir: "desc" })).toEqual([{ name: "desc" }, { id: "asc" }]);
  });

  it("sorts age by birth date in the opposite direction", () => {
    expect(buildOrderBy({ field: "age", dir: "desc" })[0]).toEqual({ birthDate: "asc" });
    expect(buildOrderBy({ field: "age", dir: "asc" })[0]).toEqual({ birthDate: "desc" });
  });

  it("sorts group by its name", () => {
    expect(buildOrderBy({ field: "group", dir: "asc" })[0]).toEqual({ group: { name: "asc" } });
  });
});
