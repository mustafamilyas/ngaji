## Context

Greenfield internal app for one organization. Full data model, permission matrix, activity logic, security requirements and page list are in `DESIGN.md` (§2–§7); this document records the architectural choices behind them and the trade-offs accepted for the MVP. Stakeholder: the project owner, who confirmed every decision listed in `DESIGN.md` §9.

Constraints: mobile-first UI (attendance is filled in on phones); member data is sensitive PII; target ~2 days of implementation; no email available for users.

## Goals / Non-Goals

**Goals:**
- Every read and write is scope-bound and fails closed; no cross-branch data leakage.
- Complete change history (who/what/when/before/after) for every mutation and login attempt.
- Recurring activities without a background job; history never lost when templates change.
- Pure, unit-tested core logic (`expandDates`, `occurrencesFor`, conflicts, `expected`, `authorize`).

**Non-Goals (DESIGN.md §10):**
- Member relations, photos, multi-role users, activity participant criteria, member move history, data export, multi-organization, per-group timezone, opt-out of inherited activities.

## Decisions

**D1. Materialized path over recursive CTE for the tree.**
`Group.path = parent.path + id + "/"`; scope = `path startsWith scopeGroup.path`. Prisma has no CTE support; `startsWith` on an indexed column is one where-clause reusable in every list query. Trailing slash prevents `"1/5/"` matching `"1/50/"`. Cost: moving a subtree rewrites paths — explicitly non-MVP. Alternative rejected: adjacency list + app-side recursion (N+1) or `ltree` (raw SQL everywhere).

**D2. Soft delete everywhere, enforced by a Prisma client extension.**
Owner requires no hard delete. A `deletedAt: null` filter injected by an extension in `lib/db.ts` for `Group`/`Member`/`Activity` removes the "forgot the filter" class of bugs. Alternative rejected: hand-written filters (one miss leaks deleted PII).

**D3. JWT session + per-request DB revalidation.**
The token carries `{userId, groupId, role, groupPath}` so scope filtering needs no join, but the `jwt` callback re-reads `User` + `UserGroupRole` (one PK lookup) so deactivation and demotion take effect on the next request. Alternative rejected: pure JWT (owner's "nonaktifkan" would be meaningless until expiry); database sessions (more tables, no real gain over one PK read).

**D4. `authorize(session, action, target)` takes a resolved entity, not an ID.**
A `resolve*()` layer loads the entity (with `group.path`) or throws `NotFoundError`; `authorize` then applies the matrix. This guarantees the "every client ID is checked" invariant and makes the 404-for-out-of-scope rule uniform. Alternative rejected: checking `groupId` from the form (client-controlled).

**D5. Lazy occurrences; rule date is the key, effective date is derived.**
`ActivityOccurrence(activityId, date)` is created only on attendance or override. `date` is the rule-generated date (stable key, used in URLs); `overrideDate` implements "move once" without breaking the unique key or detaching attendance. `occurrencesFor` unions rule dates with rows that have attendance, so template edits never hide history. Alternative rejected: generator job (needs infra, drifts on edit); making the moved date the key (attendance would need to move too).

**D6. "Move this and following" = transactional split.**
Original `endsOn = X−1`; clone with changes, `startsOn = new date`, `continuesFromId`; occurrence rows with `date ≥ X` re-parented. Reuses the existing "end from date" + "create" paths; no versioned templates. Trade-off: per-activity statistics fragment across the split — accepted for MVP, `continuesFromId` keeps the lineage.

**D7. Edit rights are strictly the owning group; attendance rights are the owning group and below.**
Confirmed by the owner: a user above the owning group (e.g. daerah admin for a kelompok activity) can see it but neither edit it nor record attendance; the root OWNER has no override. Rationale: the group that runs the activity owns its data; escalation happens socially, not in software.

**D8. Audit log is a table written inside the mutation's transaction.**
`audit(tx, …)` is called with the same Prisma transaction client; if the log write fails the mutation rolls back. `passwordHash` (and any `password*` field) is redacted at the helper, not at call sites. Login failures are also logged, which lets the login rate limit be computed from `AuditLog` (`[action, createdAt]` index) with no extra store. Alternative rejected: DB triggers (no actor context), external log sink (extra infra, not queryable by OWNER in-app).

**D9. Dates are `YYYY-MM-DD` strings in application code.**
`@db.Date` round-trips through Prisma as a JS `Date` at UTC midnight, which shifts by a day in `Asia/Jakarta`. All zod schemas, URL params, comparisons and pure functions use strings; `lib/dates.ts` is the only place `Date` is constructed. Week anchor: Sunday.

**D10. `expected(occurrence, group)` is time-aware.**
Members count toward expected only when `joinedAt ≤ date` and (`AKTIF` or `exitedAt > date`), so attendance % is not distorted by joiners/leavers. Centralized so the future "participant criteria" feature is a filter, not a rewrite.

## Risks / Trade-offs

- [Off-by-one dates from `@db.Date`/UTC] → D9; `lib/dates.ts` tests run under a non-Jakarta `TZ`.
- [A query bypasses the soft-delete extension (raw SQL, `$queryRaw`)] → forbid raw queries on those tables; review checklist item.
- [Cross-scope leak via an unchecked ID] → D4; every Server Action has a negative test with an out-of-scope ID.
- [Split re-parents an occurrence whose rule date the new template no longer generates] → union rule in `occurrencesFor` still shows it if it has attendance; orphans without attendance are ignored.
- [Rate limit computed from `AuditLog` slows as the table grows] → indexed `[action, createdAt]`; move to a dedicated table if p95 login > 200 ms.
- [Attendance page for a large leaf group is slow on phones] → leaf-only rule bounds the list; paginate members elsewhere (`PAGE_SIZE`).
- [15.5 h estimate slips] → pure logic and authz first (highest risk), checkpoint before any UI.

## Migration Plan

Greenfield: `prisma migrate dev` from an empty database, `prisma db seed` creates org, 4 levels, sample tree, owner `admin/admin` with `mustChangePassword = true`. No rollback beyond dropping the database in development.

## Open Questions

None — the two interpretations raised during review (users above the owning group cannot record attendance; root OWNER cannot edit a descendant's activity) were confirmed by the owner and are recorded in D7 and `DESIGN.md` §3.3.
