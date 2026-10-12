import type { Prisma } from "@/lib/generated/prisma/client";
import { addDays } from "@/lib/dates";
import type { Definition, Rule, RuleGroup, ViewSort } from "@/lib/validation/member-view";
import { ageBirthDateRanges, type AgeOperator } from "./age";

/**
 * Definition → Prisma input. Pure: group paths are resolved by the caller
 * (from the DB, scope-checked) and passed in. The result must always be ANDed
 * with the viewer's scope and `deletedAt: null` — this module never grants access.
 */
export type QueryContext = {
  /** Today in Asia/Jakarta, `YYYY-MM-DD`. */
  today: string;
  /** Resolved group id → `Group.path`. An id missing here matches nothing. */
  groupPaths: ReadonlyMap<number, string>;
};

type MemberWhere = Prisma.MemberWhereInput;

const NO_MATCH: MemberWhere = { id: { in: [] } };

export function ruleToWhere(rule: Rule, ctx: QueryContext): MemberWhere {
  const { field, operator, value } = rule;
  switch (field) {
    case "name":
    case "birthPlace":
      // `equals` is ASCII-case-sensitive on SQLite (design.md risks); `contains` is LIKE.
      return { [field]: operator === "equals" ? { equals: value as string } : { contains: value as string } };
    case "sex":
    case "status":
    case "maritalStatus":
    case "workStatus":
      return { [field]: operator === "isAnyOf" ? { in: value as string[] } : { notIn: value as string[] } };
    case "birthDate":
    case "joinedAt":
    case "exitedAt":
      return { [field]: dateFilter(operator, value, ctx.today) };
    case "age": {
      const ranges = ageBirthDateRanges(operator as AgeOperator, value as number | [number, number], ctx.today);
      return ranges.length === 1 ? { birthDate: ranges[0] } : { OR: ranges.map((birthDate) => ({ birthDate })) };
    }
    case "group": {
      const paths = (value as number[]).flatMap((id) => ctx.groupPaths.get(id) ?? []);
      return paths.length === 0 ? NO_MATCH : { OR: paths.map((path) => ({ group: { path: { startsWith: path } } })) };
    }
  }
}

function dateFilter(operator: string, value: unknown, today: string): Prisma.StringNullableFilter {
  switch (operator) {
    case "before":
      return { lt: value as string };
    case "onOrBefore":
      return { lte: value as string };
    case "after":
      return { gt: value as string };
    case "onOrAfter":
      return { gte: value as string };
    case "between": {
      const [from, to] = value as [string, string];
      return { gte: from, lte: to };
    }
    case "withinLastDays":
      return { gte: addDays(today, -(value as number)), lte: today };
    case "isEmpty":
      return { equals: null };
    case "isNotEmpty":
      return { not: null };
    default:
      throw new Error(`Unsupported date operator: ${operator}`);
  }
}

function groupToWhere(group: RuleGroup, ctx: QueryContext): MemberWhere {
  const parts = group.rules.map((rule) => ruleToWhere(rule, ctx));
  return group.op === "AND" ? { AND: parts } : { OR: parts };
}

/** `{}` for an empty filter, so it matches every member (the caller still applies scope). */
export function buildWhere(definition: Pick<Definition, "filter">, ctx: QueryContext): MemberWhere {
  const { op, groups } = definition.filter;
  if (groups.length === 0) return {};
  const parts = groups.map((group) => groupToWhere(group, ctx));
  return op === "AND" ? { AND: parts } : { OR: parts };
}

/** One sort key plus the stable tie-breaker (name, then id). Age sorts by birth date, direction flipped. */
export function buildOrderBy(sort: ViewSort): Prisma.MemberOrderByWithRelationInput[] {
  const { field, dir } = sort;
  const flipped = dir === "asc" ? "desc" : "asc";
  const primary: Prisma.MemberOrderByWithRelationInput =
    field === "age" ? { birthDate: flipped } : field === "group" ? { group: { name: dir } } : { [field]: dir };
  return field === "name" ? [primary, { id: "asc" }] : [primary, { name: "asc" }, { id: "asc" }];
}
