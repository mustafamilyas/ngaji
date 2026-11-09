# Isolation sweep checklist (task 4.1)

Sweep of every `findFirst` / `findMany` / `count` / `findUnique` / `groupBy` call under `app`, `lib`, `components`, `prisma` (131 call sites). Group paths are built from globally unique ids and end with `/`, so `path startsWith <session.groupPath>` cannot match another organization. Result: **no query found that can cross organizations**; the one that picked "the first organization" (`getOrganizationName`) was already replaced in 3.2.

Legend: **path** = scoped by `group.path startsWith/in`; **org** = scoped by `organizationId`; **resolve** = id resolved to its entity and path-checked first (`lib/resolve.ts`); **n/a** = global by design.

| Area | Files | Scope | Notes |
|---|---|---|---|
| Id resolution | `lib/resolve.ts` (group, member, activity, survey, occurrence, user) | resolve | `isInScope(entity.group.path, session.groupPath)`, else `NotFoundError` (404) |
| Id resolution | `lib/resolve.ts` `resolveMemberView` | resolve | no path check here; `authorize("member_view.*")` requires `view.groupId === session.groupId`, else 404 |
| Id resolution | `lib/resolve.ts` group-rule validity | path | rule group ids are dropped/rejected unless in scope |
| Group | `lib/group/mutations.ts`, `lib/group/trail.ts`, `lib/group/levels.ts` | path / org | parent resolved first; levels keyed by `organizationId` of the caller's own group |
| Level | `lib/group/levels.ts`, `app/dashboard/grup/**`, `app/dashboard/pengaturan/jenjang` | org | org id comes from the caller's group, never from the client |
| Member | `lib/member/queries.ts`, `lib/member-view/results.ts`, `sections.ts` | path | scope term ANDed into every view `where` |
| Activity | `lib/activity/list.ts`, `conflict-check.ts`, `rows.ts`, `mutations.ts` | path / resolve | related groups are ancestors + descendants of a resolved group |
| Occurrence / attendance | `lib/attendance/*`, `lib/activity/occurrence-mutations.ts` | resolve | activity, leaf group and member resolved before any read/write |
| Attendance history | `lib/attendance/history.ts` | resolve | takes a member id only; the sole caller resolves the member first |
| Stats | `lib/stats.ts` (16 queries) | path | every member/activity query keyed by the resolved scope group |
| Survey | `lib/survey/*` (list, detail, entry, respondents, responses, stats, mutations) | path / resolve | survey resolved first; `?anggota=` honoured only when in the scoped member list |
| Member view | `lib/member-view/list.ts`, `mutations.ts`, `editor-options.ts` | exact group | views are listed for `session.groupId` only |
| User | `lib/user/queries.ts`, `lib/user/mutations.ts` | path / resolve | last-owner count is per root group id; username uniqueness is global (4.2) |
| Audit log | `lib/audit-log/queries.ts` | path | entries filtered by the ids of in-scope groups plus the caller's own group-less `auth.*` entries |
| Pages | `app/dashboard/**/page.tsx` group pickers | path | all use `visibleGroupsWhere(session.user)` |
| Auth | `lib/auth/*` | n/a | username/id lookups and per-IP login rate limit are global by design |
| Organization | `lib/organization.ts` | org / n/a | `getOrganization(session)` by session org id; `getLoginBrand` is public and gated by the flag |
| CLI | `prisma/bootstrap.ts`, `prisma/seed.ts`, `lib/user/recovery.ts` | n/a | run by an operator on the host, not reachable from a request |

## Cross-org tests

`lib/isolation.test.ts` (org A root OWNER versus org B ids; a mutation-check on `listMembers` scope fails it) and the member detail page test in `app/dashboard/anggota/[id]/page.test.ts` cover: organization context, level, group, member, activity, occurrence, attendance, survey, member view, user (incl. per-org last-owner protection) and audit log. Mutations answer 404 and write nothing (no row change, no audit entry); lists contain no org B row.
