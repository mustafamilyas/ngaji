# Design

## Context

See proposal.md (Why). Every activity rule today is a function of one owner path: `canViewActivity(session, activityGroupPath)`, `canEditActivity(session, activityGroupId)`, `canRecordAttendance(session, activityGroupPath, leaf)` in `lib/authz.ts`; `canTagActivity(user, tagGroupPath, activityGroupPath)` in `lib/tag/access.ts`; listing (§5.3), conflicts (§5.4) and expected members (`lib/stats.ts`) all use "owner path is ancestor/self of Y". Users have a primary role plus optional additional ADMIN roles below it (`adminGroupIds`, §3.2a).

## Goals / Non-Goals

**Goals:** generalize "the activity's group" to "the owner groups effective on a date" without changing behavior for activities that have no joint owners; keep the cross-scope exception confined to one activity's attendance pages.

**Non-Goals:** notifications, joint surveys, transferring the creator role, per-owner schedule variants.

## Decisions

### D1. Model
```
ActivityCoOwner
  activityId, groupId            @@unique
  status        PENDING | ACCEPTED | DECLINED | CANCELLED   (String + zod enum)
  startsOn      String           // chosen by the creator group on invite (default org-local today); editable by it
  endsOn        String?          // set on removal; last applicable date = endsOn
  invitedById, respondedById?, removedById?
  createdAt, updatedAt
  @@index([groupId, status])
```
One row per (activity, group); re-invite after decline, cancel or removal updates the row back to `PENDING` with the new `startsOn` and clears `endsOn` (audit keeps the history; re-inviting a removed group must pass D8). Nothing is hard-deleted: cancel sets `CANCELLED`; removal sets `endsOn` and keeps `ACCEPTED`.
*Alternative:* move the creator into the table too — rejected; `Activity.groupId` already identifies the creator and drives every existing query.

### D2. One helper: `ownersOn(activity, date)`
Pure function returning the creator + accepted joint owners whose `[startsOn, endsOn]` contains `date`. Everything date-specific (expected members, attendance validity, conflicts, listing) calls it. Date-free checks use `currentOwners(activity)` = creator + accepted joint owners with no `endsOn` (edit, tag) or `ownerHistory(activity)` = creator + all accepted (visibility of history).

### D3. Authorization
- `canViewActivity(session, activity)`: some owner-group path (history) ∈ ancestors(G) ∪ scope(U); plus pending-invite admins in invitation mode (D5).
- `canEditActivity(session, activity)`: `adminGroupIds(session)` ∩ `currentOwners` ≠ ∅ — template, override, split, end.
- `canDeleteActivity(session, activity)`: `adminGroupIds(session)` includes the creator group — delete, and an end that would delete (`endingDeletesActivity`); also invite, change start date, cancel, remove (`activity.manageCoOwners`).
- `isJointAdmin(session, activity, date?)`: `adminGroupIds(session)` ∩ (creator + accepted joint owners with `endsOn` null or ≥ `date`) ≠ ∅; without a date (activity-level pages) ended joint owners count only for dates ≤ their `endsOn`.
- `canRecordAttendance`: today's three conditions with "activity path" replaced by "some owner path effective on the date", **or** `isJointAdmin(…, date)` and the leaf is under some owner effective on that date.
- `activity.respond`: ADMIN/OWNER on the invited group exactly (`adminGroupIds` includes it).
All take resolved entities from `resolveActivity`, which now loads joint owners. `adminGroupIds` stays the single source, so rights never derive from scope.

### D4. Population for attendance pages
Attendance table and Absensi tab compute leaf groups as: joint admin → all leaves under owners effective on the date(s); otherwise → leaves in the user's scope under those owners. Removed joint owners stay included for dates ≤ their `endsOn`.

### D5. Pending visibility
`resolveActivity` allows a user whose `adminGroupIds` contains a `PENDING` joint owner to load the activity in "invitation" mode: the detail page renders header/facts/owners only; Absensi/Pengaturan tabs, tag picker and every attendance route return 404 (or 403 for mutations) in that mode. "Undangan kegiatan" = query of pending rows for `adminGroupIds(session)`, shown on `/dashboard` and atop `/dashboard/kegiatan`, paginated `EMBEDDED_PAGE_SIZE`.

### D6. Listing, conflicts, statistics
- §5.3 step 1 becomes: activities where the creator **or** an accepted joint owner is in ancestors(Y) ∪ {Y} ∪ descendants(Y) (`OR` with `coOwners: { some: { groupId in ..., status: ACCEPTED } }`), then occurrences filtered by `ownersOn` per date. `inherited` is false when Y is in or below an owner group.
- §5.4 "apply to a common group" uses owner paths effective on the occurrence date.
- `expected()` is unchanged; its input member list is the union of subtrees of `ownersOn(date)` intersected with the page's population.

### D7. Eligibility check
Pure `eligibleCoOwner(creatorPath, existingPaths[], candidatePath)` — rejects self, any ancestor/descendant relation, duplicates. Run inside the invite transaction after re-reading joint owners (SQLite serializes writes).

### D8. History guard
Before moving `startsOn` later or setting `endsOn`, inside the same transaction: find the min/max key date among the activity's occurrences with an `Attendance` whose member is in the joint owner's subtree; reject if the new window excludes it, naming that date. Pure `ownershipWindowViolation(window, recordedDates)` is unit-tested; the query is covered by an action test.

### D9. Tags
`canTagActivity(user, tagGroupPath, activity)`: the user can use the tag (§13.2) and the tag's owner group is on the ancestor chain of, or in the subtree of, some current owner group. Exclusivity (`tagIdsReplacedBy`) is unchanged — it already keys on (tag owner group, key). Visibility is untouched (`visibleTagLinks`), so cross-branch tags simply do not render for the other side. Split copies all tag links (existing rule).

## Risks / Trade-offs

- [Cross-scope names exposed to joint admins] → limited to the activity's attendance pages; out-of-scope members rendered as plain text without links; negative tests (member page 404, member list unchanged); documented in DESIGN.md §3.3 and §4.
- [Several groups editing one schedule] → every edit is audited with actor; the activity header lists creator and joint owners so everyone knows who can change it.
- [Every activity query gains a joint-owner join] → index on `(groupId, status)`; activities without joint owners behave identically (regression on existing suites).
- [Org-wide group picker reveals group names] → confirmed acceptable by the project owner; names only, no counts.

## Migration Plan

Additive migration (new table). Existing activities have no joint owners, so behavior is unchanged. Rollback: previous image ignores the table; joint owners simply stop seeing the activity.
