# Design

## Context

- `Organization`, `Level.organizationId` and `Group.organizationId` already exist. Scope is `group.path startsWith user.groupPath`. Each org has its own root group, so paths of different orgs never overlap, and path scope already isolates orgs for everything hung off a group. What does **not** isolate today:
  - `getOrganizationName()` (`lib/organization.ts`) is `findFirst` over all orgs.
  - `lib/dates.ts` hardcodes `TIMEZONE = "Asia/Jakarta"`, and about 25 files call `today()`/`dateOf()`. Three of them are client components (member form, activity form, quick-register dialog). `Intl` formatters in `audit/page.tsx` and `respondents-tab.tsx` also hardcode the timezone.
  - The login page and the root layout read the org name without a user.
- The `jwt` callback already re-reads the user from the DB on every request (DESIGN.md §4.1).
- `prisma/bootstrap.ts` refuses a non-empty DB, writes no audit entries and uses no transaction.
- The login rate limit counts `AuditLog` rows. The audit viewer drops group-less entries other than the caller's own `auth.*` entries.
- The print page already renders `effectiveNotes`. The list and calendar do not.

## Goals / Non-Goals

**Goals:** make org identity flow from the session; keep single-org deploys working unchanged apart from the login flag; reuse the existing patterns (path scope, `authorize`, `audit`, AuditLog-based rate limit, zod in `lib/validation`).

**Non-Goals:** a platform super-admin UI, cross-org users, per-org subdomains, logo upload or rendering, lead status workflow or retention jobs, editing Keterangan from places other than the existing occurrence dialog.

## Decisions

1. **Org context in the session, re-read per request.** The `jwt` callback already loads the user and role. It also selects `group.organizationId` and `organization.timezone` and exposes `session.user.organizationId` and `session.user.timeZone`. Because the callback re-reads them on every request, a settings change takes effect on the next request with no extra invalidation. `getOrganization(session)` (React `cache`) replaces `getOrganizationName()` and loads name/timezone by `session.user.organizationId`.
   - Alternative: query by `groupId` in every caller. Rejected because it is repetitive and easy to forget.
   - Alternative: trust org data in the JWT. Rejected; it goes against the §4.1 re-validation rule.
2. **`today(timeZone)` / `dateOf(instant, timeZone)` take a required argument.** Removing the default makes every forgotten caller a type error rather than a silent WIB fallback. Client components receive `today` as a prop from their Server Component parent; they never compute it. Timestamp formatters take the timezone from the session. The allowed values live in `lib/validation/enums.ts` as `TIMEZONES = ["Asia/Jakarta","Asia/Makassar","Asia/Jayapura"]` with labels WIB/WITA/WIT. `Organization.timezone` stays a `String` column.
3. **Login flag.** `LOGIN_SHOW_ORG_NAME === "true"` → `db.organization.findMany({ take: 2 })`. The name is shown only if exactly one row comes back. A pure helper `loginBrand(flag, orgs)` is unit-tested. The root layout's metadata, when there is no session, never reads the org.
4. **Isolation audit, not a new filter layer.** No global Prisma middleware adds `organizationId`. Path scope already covers group-hung entities. The work is a sweep for queries that are not path-scoped (org-wide lookups, `findFirst` without a scope, level queries, username checks), plus cross-org tests on a second org added to the dev seed and test fixtures.
   - Alternative: a Prisma `$extends` that injects org filters. Rejected: it duplicates path scope and does not fit `Level`/`Organization`.
5. **`org:create` = generalized bootstrap.** Move the logic into `lib/organization/provision.ts` as a function `provisionOrganization(tx, input)`, so it can be tested. It runs in one `$transaction` and writes `organization.create` and `user.create` audit entries (`actorId: null`, `groupId: root`). `prisma/org-create.ts` reads env vars and calls it. `pnpm bootstrap` points to the same script. The "empty DB" guard is replaced by a "username not taken" check. New variable `BOOTSTRAP_TIMEZONE`; existing variable names stay, so DEPLOYMENT.md changes minimally.
6. **Leads.** A new model `InterestLead { id, name, phone, organizationName, memberCount Int?, message String?, consentAt DateTime, ip String?, userAgent String?, createdAt }` has no relation to `Organization`. A public Server Action at `/daftar` uses a zod schema shared with the form. The honeypot field is checked first and returns fake success. The rate limit counts `lead.create` AuditLog rows per IP in the window (constants `INTEREST_RATE_LIMIT_MAX_PER_IP = 5`, `INTEREST_RATE_LIMIT_WINDOW_MINUTES = 60`), under the same keyed lock pattern as login. The lead and its audit entry (`groupId: null`, `actorId: null`, PII kept only in the `InterestLead` row, `meta: { leadId }`) are written in one transaction. The action returns the `wa.me` URL; the client calls `window.location.assign` and also renders a link. The prefilled text is built by a pure, tested helper. `scripts/leads.ts` (`pnpm leads [--csv]`) is read-only.
   - Alternative: a separate rate-limit table. Rejected; it adds a pattern for no gain.
7. **Settings page.** `/dashboard/pengaturan` becomes a real page with two forms: organization (name, timezone) and levels (the existing `rename-level-form`). `/dashboard/pengaturan/jenjang` redirects to it. A new authz action `organization.update` uses the same predicate as `level.rename` (OWNER with a depth-0 group). Updates write `organization.update` with before/after inside the transaction. `logoUrl String?` is added to the migration only.
8. **Keterangan in the list and calendar.** `listActivityOccurrences` already returns `effectiveNotes`. The list row renders it as a muted, line-clamped (2 lines) secondary line with a `title`/expand for the full text. The calendar entry shows one clamped line. React escaping covers "no markup".
9. **Single-table print.** `groupScheduleByDate` keeps its output shape (days → entries). The page renders one `<table>` with `<thead class="table-header-group">`. The first row of each day carries `<td rowSpan={n}>` for Tanggal, and a top border marks day boundaries. Print CSS uses `text-[11px]`, `py-0.5` and `tr { break-inside: avoid }`. The header org name comes from `getOrganization(session)`.

## Risks / Trade-offs

- [A missed unscoped query leaks data across orgs] → sweep task with a checklist of every `findFirst`/`findMany`/`count` without `path`/`organizationId`; cross-org tests per entity type; a second org in the seed so manual testing hits it.
- [Global usernames let one org probe whether a username exists in another] → accepted. The message is the same generic one used within an org, and usernames are not secret. Recorded in DESIGN.md.
- [Changing the timezone moves "today" for an org mid-day] → this is the expected effect and is audited. Stored data is unchanged.
- [The public form writes to the DB, so spam fills SQLite] → honeypot, per-IP limit, field length caps in zod. Leads can be cleaned manually if needed.
- [Lead PII without retention rules (UU PDP)] → consent checkbox and consent timestamp now; retention is left as an open question.
- [The `today()` signature change touches about 25 files at once] → it is mechanical, and `tsc` lists every caller. Done as its own task before the settings UI.

## Migration Plan

1. Prisma migration: add `Organization.logoUrl`, add `InterestLead`. No data backfill; existing orgs keep `timezone = "Asia/Jakarta"`.
2. Deploy. Single-org deployments see a generic login until `LOGIN_SHOW_ORG_NAME=true` is set. Document this in DEPLOYMENT.md.
3. Rollback: the code rollback is safe. The new column and table are additive and can stay.

## Open Questions

- Retention period and deletion process for leads (UU PDP). Deferrable; it changes neither the schema nor the flow.
