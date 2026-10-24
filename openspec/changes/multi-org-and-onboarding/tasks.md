# Tasks

## 1. Schema and constants

- [x] 1.1 Add `Organization.logoUrl String?` and the `InterestLead` model; run `pnpm prisma migrate dev` and verify the migration applies on a copy of the current dev DB with no data change to existing orgs
- [x] 1.2 Add `TIMEZONES` (+ WIB/WITA/WIT labels) to `lib/validation/enums.ts` and `INTEREST_RATE_LIMIT_MAX_PER_IP`, `INTEREST_RATE_LIMIT_WINDOW_MINUTES` to `lib/constants.ts`; verify `pnpm tsc --noEmit`
- [ ] 1.3 Extend `prisma/seed.ts` and `lib/test/fixtures.ts` with a second organization (own levels, root group, OWNER, members, activities); verify `pnpm prisma db seed` creates both and existing tests still pass

## 2. Pure logic (tests first)

- [ ] 2.1 Change `today(timeZone)` / `dateOf(instant, timeZone)` to a required timezone; add tests for the WIB/WIT midnight boundary from the organization-settings spec; verify `pnpm test lib/dates`
- [ ] 2.2 Add `loginBrand(flag, orgs)` with tests for flag off / on + one org / on + two orgs / on + none; verify the tests pass
- [ ] 2.3 Add interest validation schema (shared form/server), WhatsApp prefilled-text builder and leads CSV formatter with tests (consent required, invalid phone, quoting of commas/newlines); verify the tests pass

## 3. Session and org context

- [ ] 3.1 In the `jwt` callback, re-read `group.organizationId` and `organization.timezone` per request and expose `session.user.organizationId` / `timeZone`; verify with a test that changing the org timezone in the DB is reflected on the next callback run
- [ ] 3.2 Replace `getOrganizationName()` with `getOrganization(session)`; update the dashboard layout, root layout metadata and print header; verify the cross-org test: a user of org B sees org B's name
- [ ] 3.3 Update every `today()`/`dateOf()` caller and the hardcoded `Intl` timezones to use the session timezone; pass `today` as a prop into the three client components; verify `pnpm tsc --noEmit` is clean and `grep -rn "Asia/Jakarta" app lib components` only hits `lib/validation/enums.ts` and defaults
- [ ] 3.4 Make `/login` generic via `loginBrand` (page + `Masuk · …` title); verify `app/login/page.test.ts` covers the four flag scenarios

## 4. Isolation sweep and authz

- [ ] 4.1 Sweep all `findFirst`/`findMany`/`count`/`findUnique` calls that are not path- or organization-scoped and fix any that can cross orgs; record the checklist in the PR description; verify cross-org tests (member, activity, occurrence, attendance, survey, member view, user, level, audit log) return 404/empty for org A's root OWNER on org B's data
- [ ] 4.2 Verify username uniqueness across orgs: test that creating a user in org B with an org A username fails with the generic message
- [ ] 4.3 Add authz action `organization.update` (root OWNER only) with tests for ADMIN-at-root and OWNER-below-root denial; verify `pnpm test lib/authz`

## 5. Organization provisioning CLI

- [ ] 5.1 Extract `provisionOrganization(tx, input)` (transaction + `organization.create`/`user.create` audits, `mustChangePassword`) with tests for empty DB, second org, taken username, bad timezone, weak password; verify the tests pass
- [ ] 5.2 Add `prisma/org-create.ts`, `pnpm org:create`, point `pnpm bootstrap` at it, add `BOOTSTRAP_TIMEZONE`; verify by running it twice against a scratch DB (two orgs created, password never printed)

## 6. Organization settings

- [ ] 6.1 Add `updateOrganization` mutation + server action (name, timezone, audit with before/after); verify action tests for success and both denial cases
- [ ] 6.2 Build `/dashboard/pengaturan` (org form + level renaming), redirect `/dashboard/pengaturan/jenjang`, show "Pengaturan" nav only to root OWNERs; verify page tests for root OWNER (forms shown) and others (no-permission message), and check in the browser preview at 360px

## 7. Interest sign-up

- [ ] 7.1 Add `/daftar` to the public allowlist in `lib/auth/public-paths.ts`; verify the proxy test: anonymous `/daftar` returns 200, `/dashboard/*` still redirects
- [ ] 7.2 Add the public `submitInterest` action (honeypot, AuditLog-based per-IP limit under keyed lock, lead + `lead.create` in one transaction, returns `wa.me` URL or null); verify action tests for success, honeypot, rate limit, tampered input, missing `DAHAN_WHATSAPP`, and that `lead.create` is absent from every org's audit viewer
- [ ] 7.3 Build the `/daftar` page (form, consent, success state with WhatsApp link, redirect) and point the landing and `/ormas` CTA to `/daftar`; verify in the browser preview: submit opens the prefilled WhatsApp URL, no external requests, usable at 360px
- [ ] 7.4 Add `scripts/leads.ts` (`pnpm leads [--csv]`, read-only); verify by running it against the dev DB with two seeded leads

## 8. Keterangan and compact print

- [ ] 8.1 Show `effectiveNotes` in the activity list rows and calendar entries (plain text, clamped, full text available); verify page tests for per-date notes, fallback to activity notes and literal markup, and check at 360px in the browser preview
- [ ] 8.2 Rework `/dashboard/kegiatan/cetak` into one table (Tanggal rowspan, repeated header, compact print CSS); update `page.test.ts` for single header row, date shown once, hide-cancelled; verify print preview of a 15-occurrence week fits one A4 page

## 9. Docs and final checks

- [ ] 9.1 Update DESIGN.md (§1 tenancy, §2 schema, §3.2 `organization.update`, §4.5 new audit actions, §7 pages `/daftar` + `/dashboard/pengaturan`, §8 `org:create`, §10 multi-org row), DEPLOYMENT.md (`org:create`, `BOOTSTRAP_TIMEZONE`, `LOGIN_SHOW_ORG_NAME`, `pnpm leads`), CLAUDE.md commands and `openspec/config.yaml` context; verify they match the specs
- [ ] 9.2 Run `pnpm lint && pnpm tsc --noEmit && pnpm test` and verify everything passes

## 10. Additional tasks (failures found during implementation)

- [ ] 10.1 `pnpm tsc --noEmit` reports 32 errors, all in the stale, git-ignored `.next/types/validator.ts` (e.g. missing `app/statistik/page.js`); none in source files (found at 1.1). Make tsc robust against stale `.next` output (confirmed at 1.2: `rm -rf .next/types` makes it exit 0; alternatively exclude `.next/types` from `tsconfig.json`) and verify `pnpm tsc --noEmit` exits 0 on a tree with an old `.next`
- [ ] 10.2 `pnpm test` fails under an AI agent because `vitest.global-setup.ts` runs `prisma db push --accept-data-loss`, which Prisma guards behind `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` (found at 1.1; it passed once the user consented, since it only recreates `prisma/test.db`). Replace it with a non-destructive path for the freshly deleted test DB (e.g. `prisma migrate deploy`) and verify `pnpm test` runs without the consent variable
