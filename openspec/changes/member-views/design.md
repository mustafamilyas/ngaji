# Design

## Context

See proposal.md for motivation. Relevant existing pieces:
- `/anggota` already parses filters and sort from the URL (`lib/filters.ts`, `lib/sort.ts`), lists via `lib/member/queries.ts`, and stores columns in the `anggota_kolom` cookie (`lib/member/columns.ts`).
- Scope = `group.path startsWith user.groupPath`; all mutations go through `authorize()` and `audit(tx, …)` (DESIGN.md §3, §4.5).
- Dates are `YYYY-MM-DD` strings everywhere; `ageInYears` lives in `lib/dates.ts`; `AGE_BRACKETS` in `lib/constants.ts`.
- SQLite via Prisma: no enums, `Json` columns, `LIKE` is case-insensitive for ASCII only.

## Goals / Non-Goals

**Goals:**
- One definition format, validated by one zod schema, used for saved views and URL drafts alike.
- Translate a definition into a single Prisma `where` (plus `orderBy`) so filtering, counting and pagination happen in the database.
- Keep the field list in one server-side registry so adding a data source later means adding registry entries, not rewriting the engine.

**Non-Goals:**
- Private views, other data sources (attendance rate, survey answers), export, multi-key sort, deeper rule nesting.
- Changing `/anggota`; it keeps its own simple filters.
- Sharing views across groups or linking a view from outside its group.

## Decisions

### 1. Data model
```prisma
model MemberView {
  id          Int       @id @default(autoincrement())
  groupId     Int
  ownerId     Int
  createdById Int
  name        String
  source      String    @default("member")   // ViewSource: "member"
  visibility  String    @default("GROUP")    // ViewVisibility: "GROUP"
  definition  Json
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  // relations: group, owner (User "memberViewOwner"), createdBy (User "memberViewCreatedBy")
  @@index([groupId, deletedAt])
}
```
- `ownerId` is separate from `createdById` so takeover changes ownership without losing who created it.
- `source` / `visibility` are string enums (`lib/validation/enums.ts`) with a single value each; they exist now so private views and new sources need no migration of meaning.
- Name uniqueness (case-insensitive, non-deleted, per group) is checked in the app, like group sibling names.

*Alternative*: normalized rule tables. Rejected — rules are always read and written as a whole, need versioning, and are never queried individually.

### 2. Definition format (`lib/member-view/definition.ts`)
```ts
type Definition = {
  version: 1;
  filter: { op: "AND" | "OR"; groups: { op: "AND" | "OR"; rules: Rule[] }[] };
  sort: { field: SortField; dir: "asc" | "desc" };
  groupBy?: { kind: "property"; field: "sex" | "status" | "maritalStatus" | "workStatus" }
          | { kind: "groupLevel"; depth: number }
          | { kind: "ageBuckets"; buckets: { label: string; min: number; max: number | null }[] };
  columns: MemberColumnKey[];
};
type Rule = { field: FieldKey; operator: Operator; value: unknown }; // value shape checked per (field, operator)
```
- A zod discriminated union per field type validates operator + value. `.strict()` everywhere so unknown keys are rejected.
- Two parse modes: **strict** (save — any problem rejects) and **lenient** (load and URL draft — invalid rules / sort / columns are dropped individually and reported as warnings). Lenient parsing is what makes stale saved views still open.
- Group IDs are checked after parsing against the DB (`resolveGroups` semantics): strict → reject; lenient → drop rule + warning.
- Limits in `lib/constants.ts`: `VIEW_MAX_RULE_GROUPS = 10`, `VIEW_MAX_RULES_PER_GROUP = 10`, `VIEW_MAX_AGE_BUCKETS = 12`, `VIEW_SECTION_PAGE_SIZE = 25`, `VIEW_EXPANDED_SECTIONS = 5`, `VIEW_MAX_DRAFT_LENGTH` (URL draft bytes).

### 3. Field registry (`lib/member-view/fields.ts`)
One entry per queryable field: key, label (Indonesian), type (`text` | `choice` | `date` | `nullableDate` | `age` | `group`), allowed operators, enum values, sortable, groupable. `phone`, `address`, `email` are simply absent, so the PII rule is enforced by construction and covered by a test. Later sources add their own registry keyed by `source`.

### 4. Definition → Prisma (`lib/member-view/query.ts`, pure)
`buildWhere(definition, today)` returns a Prisma `MemberWhereInput`; the caller ANDs it with `{ deletedAt: null, group: { path: { startsWith: viewer.groupPath } } }` so scope can never be bypassed.
- Text: `contains` / `equals` on trimmed value (ASCII case-insensitive is accepted; noted in risks).
- Choice: `in` / `notIn`.
- Dates: string comparisons (`lt`, `lte`, `gt`, `gte`); "within the last N days" → `gte: addDays(today, -N), lte: today`.
- **Age → birth date**: with `cut(N) = (todayYear − N) + "-" + MM-DD of today` as a plain string, `age ≥ N ⇔ birthDate ≤ cut(N)` and `age ≤ N ⇔ birthDate > cut(N + 1)`; `=`, `≠`, `>`, `<`, `between` derive from these. Comparing strings avoids Date math and matches `ageInYears` exactly, including Feb 29 (a non-existent string like `2023-02-29` still sorts correctly). Property-tested against `ageInYears`.
- Group: `OR` of `group.path startsWith <resolved path>`.
- AND/OR map directly to Prisma `AND` / `OR` arrays.
- Sort → `orderBy` array ending with `name asc, id asc`; age flips to `birthDate` with the opposite direction; group sorts by `group.name`.

*Alternative*: load all scoped members and filter in memory. Rejected — fine today but duplicates the logic and breaks pagination for large scopes.

### 5. Grouping (`lib/member-view/sections.ts`)
Each section is described by an extra `where` predicate, so counts and per-section pages reuse `buildWhere`:
- Property: one section per enum value present — counts via one `groupBy` on that column.
- Age buckets: one predicate per bucket (birth-date range from §4) plus "Lainnya" = NOT any bucket — one `count` per bucket (≤ 12 queries).
- Org level: fetch groups at `depth` in scope, `groupBy groupId` counts for matching members, roll up leaf counts to the ancestor at that depth in memory using paths; section predicate = `group.path startsWith ancestor.path`.
- Initial render loads the first `VIEW_SECTION_PAGE_SIZE` members of each non-empty section (sections collapsed beyond the first `VIEW_EXPANDED_SECTIONS` to bound the initial query count). "Tampilkan lebih banyak" calls a server action `loadSection(viewId | draft, sectionKey, offset)` that re-validates and re-authorizes everything. Collapsed state is client-only (`localStorage`, try/catch).

### 6. URL drafts
The draft definition is serialized as compact JSON → base64url in `?d=`. Absent `?d` = saved definition. On load: decode, length-check, lenient-parse; on failure show the saved definition with a generic notice. "Batalkan" removes `?d`. No draft is written to the DB, so drafts are not audited.

### 7. Authorization & resolution
- `resolveMemberView(session, id)` loads a non-deleted view and its owner; `authorize` gets the resolved entity: `{ groupId, ownerId, ownerIsActive, ownerGroupId }`.
- `member_view.view`: `view.groupId === user.groupId` else NotFound. Update/delete: plus `ownerId === user.id` else Forbidden. Transfer: role ≥ ADMIN and orphaned (`!ownerIsActive || ownerGroupId !== view.groupId`) else Forbidden.
- Create always uses `session.user.groupId`; client never sends a group.

### 8. Pages (`app/tampilan/*`)
- `/tampilan`: server component list following §7.1 list conventions (search `q`, `PAGE_SIZE`, row menu).
- `/tampilan/[id]` and `/tampilan/baru`: server component renders results; a client filter bar edits the draft and pushes `?d=` via the router. Filter bar shows rule groups as chips (mobile: a sheet with the rule editor). "Tampilan" popover: group-by, sort, columns. Header actions: "Simpan" (owner, when draft), "Simpan sebagai baru" (dialog with name), "Ambil alih" (ADMIN+, orphaned). Danger zone (owner): rename is in the header dialog; delete in the danger zone with `confirm()`.

## Risks / Trade-offs

- [SQLite `LIKE` is ASCII-only case-insensitive] → acceptable for Indonesian names (mostly ASCII); documented.
- [Saved definitions drift as enums/fields change] → `version` + lenient load with warnings; a future breaking change adds a migration function `v1 → v2` in `definition.ts`.
- [Long URL drafts] → `VIEW_MAX_DRAFT_LENGTH` + rule limits keep drafts well below URL limits; beyond it the draft is rejected with a notice.
- [Many sections in org-level grouping (e.g. 200 kelompok)] → counts come from one `groupBy`; only the first few sections load members initially.
- [A view stays visible to its group with an orphaned owner until someone takes over] → "Ambil alih" is shown to ADMIN/OWNER of the group with an explanation.
- [Text filter values may contain names (PII) in the audit log] → audit is OWNER-only within scope, same as member snapshots.

## Migration Plan

One additive Prisma migration (`member_views`); no backfill. Rollback = revert the migration and code; no existing table changes.
