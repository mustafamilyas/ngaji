# Tasks

## 1. Schema and constants

- [x] 1.1 Add `Organization.logoUrl String?` and the `InterestLead` model; run `pnpm prisma migrate dev` and verify the migration applies on a copy of the current dev DB with no data change to existing orgs
- [x] 1.2 Add `TIMEZONES` (+ WIB/WITA/WIT labels) to `lib/validation/enums.ts` and `INTEREST_RATE_LIMIT_MAX_PER_IP`, `INTEREST_RATE_LIMIT_WINDOW_MINUTES` to `lib/constants.ts`; verify `pnpm tsc --noEmit`
- [x] 1.3 Extend `prisma/seed.ts` and `lib/test/fixtures.ts` with a second organization (own levels, root group, OWNER, members, activities); verify `pnpm prisma db seed` creates both and existing tests still pass

## 2. Pure logic (tests first)

- [x] 2.1 Change `today(timeZone)` / `dateOf(instant, timeZone)` to a required timezone; add tests for the WIB/WIT midnight boundary from the organization-settings spec; verify `pnpm test lib/dates`
- [x] 2.2 Add `loginBrand(flag, orgs)` with tests for flag off / on + one org / on + two orgs / on + none; verify the tests pass
- [x] 2.3 Add interest validation schema (shared form/server), WhatsApp prefilled-text builder and leads CSV formatter with tests (consent required, invalid phone, quoting of commas/newlines); verify the tests pass

## 3. Session and org context

- [x] 3.1 In the `jwt` callback, re-read `group.organizationId` and `organization.timezone` per request and expose `session.user.organizationId` / `timeZone`; verify with a test that changing the org timezone in the DB is reflected on the next callback run
- [x] 3.2 Replace `getOrganizationName()` with `getOrganization(session)`; update the dashboard layout, root layout metadata and print header; verify the cross-org test: a user of org B sees org B's name
- [x] 3.3 Update every `today()`/`dateOf()` caller and the hardcoded `Intl` timezones to use the session timezone; pass `today` as a prop into the three client components; verify `pnpm tsc --noEmit` is clean and `grep -rn "Asia/Jakarta" app lib components` only hits `lib/validation/enums.ts` and defaults
- [x] 3.4 Make `/login` generic via `loginBrand` (page + `Masuk · …` title); verify `app/login/page.test.ts` covers the four flag scenarios

## 4. Isolation sweep and authz

- [x] 4.1 Sweep all `findFirst`/`findMany`/`count`/`findUnique` calls that are not path- or organization-scoped and fix any that can cross orgs; record the checklist in `isolation-checklist.md`; verify cross-org tests (member, activity, occurrence, attendance, survey, member view, user, level, audit log) return 404/empty for org A's root OWNER on org B's data
- [x] 4.2 Verify username uniqueness across orgs: test that creating a user in org B with an org A username fails with the generic message
- [x] 4.3 Add authz action `organization.update` (root OWNER only) with tests for ADMIN-at-root and OWNER-below-root denial; verify `pnpm test lib/authz`

## 5. Organization provisioning CLI

- [x] 5.1 Extract `provisionOrganization(tx, input)` (transaction + `organization.create`/`user.create` audits, `mustChangePassword`) with tests for empty DB, second org, taken username, bad timezone, weak password; verify the tests pass
- [x] 5.2 Add `prisma/org-create.ts`, `pnpm org:create`, point `pnpm bootstrap` at it, add `BOOTSTRAP_TIMEZONE`; verify by running it twice against a scratch DB (two orgs created, password never printed)

## 6. Organization settings

- [x] 6.1 Add `updateOrganization` mutation + server action (name, timezone, audit with before/after); verify action tests for success and both denial cases
- [x] 6.2 Build `/dashboard/pengaturan` (org form + level renaming), redirect `/dashboard/pengaturan/jenjang`, show "Pengaturan" nav only to root OWNERs; verify page tests for root OWNER (forms shown) and others (no-permission message), and check in the browser preview at 360px

## 7. Interest sign-up

- [x] 7.1 Add `/daftar` to the public allowlist in `lib/auth/public-paths.ts`; verify the proxy test: anonymous `/daftar` returns 200, `/dashboard/*` still redirects (verified at allowlist level in `public-paths.test.ts`: `/daftar` allowed, `/Daftar`, `/daftar/`, `/daftar/1` and `/dashboard/*` rejected; the HTTP 200 check moves to 10.8 because the page does not exist until 7.3)
- [x] 7.2 Add the public `submitInterest` action (honeypot, AuditLog-based per-IP limit under keyed lock, lead + `lead.create` in one transaction, returns `wa.me` URL or null); verify action tests for success, honeypot, rate limit, tampered input, missing `DAHAN_WHATSAPP`, and that `lead.create` is absent from every org's audit viewer
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
- [x] 10.2 `pnpm test` fails under an AI agent because `vitest.global-setup.ts` runs `prisma db push --accept-data-loss`, which Prisma guards behind `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` (found at 1.1; it passed once the user consented, since it only recreates `prisma/test.db`). Replace it with a non-destructive path for the freshly deleted test DB (e.g. `prisma migrate deploy`) and verify `pnpm test` runs without the consent variable
- [ ] 10.3 `sessionFor()` in `lib/test/fixtures.ts` falls back to `organizationId: 0` when the group argument carries none (found at 3.1; 239 callers pass `{ id, path }` only). Tests that need the actor's real org (3.2 cross-org name, 4.1 sweep) must pass a group with `organizationId`; consider making it required in the fixture group types once those slices land
- [x] 10.4 Usernames are case-sensitive: `usernameSchema` accepts uppercase and the SQLite `@unique` index is case-sensitive, so `Budi` and `budi` can both exist, within one org or across orgs, and login looks up the exact string (found at 4.2). Decided: usernames are always lowercase (shared `lib/validation/username.ts`; login, create user and `reset-owner-password` normalize; migration `lowercase_usernames` lowercases existing rows and aborts on a case collision); multi-organization spec and DESIGN.md updated; verified with schema, login and recovery tests. Task 5.1 must reuse `usernameSchema` for the owner username

- [ ] 10.5 Form inputs, selects and submit buttons on `/dashboard/pengaturan` are 32–36px tall at 360px, below the 44px tap-target minimum of section 11 (found at 6.2; `fieldClass` in `organization-form.tsx` and `rename-level-form.tsx` use `h-9`, buttons use the default size). Fix with a shared touch-friendly size on small screens and verify heights ≥ 44px at 360px; covered by 11.1
- [x] 10.6 In the settings form, the timezone `<select>` reverted to its first-mount value after a successful save (DB and audit were correct; only the display lied) because React 19 resets the form to first-mount defaults after the action (found at 6.2 in the 360px browser check). Fixed by keying the select on the saved timezone so it remounts with the new default; verified in the browser (WIT to WIB shows WIB with "Tersimpan.")
- [ ] 10.7 The settings form's save-then-display behavior has no automated test, because the repo has no jsdom/component test setup (found at 6.2; only verified manually in the browser). Decide whether to add a client-component test harness or keep browser verification for client forms

- [ ] 10.8 The repo has no test of `proxy.ts` itself (only the pure `isPublicPath`), so "anonymous `/daftar` returns 200 while `/dashboard/*` redirects" was not checked end to end at 7.1 (found at 7.1). After 7.3, verify in the browser preview with no session: `/daftar` returns 200 and `/dashboard/anggota` redirects to `/login`; decide whether a proxy-level test is worth adding

- [ ] 10.9 The generated Prisma client (`lib/generated/prisma`, git-ignored) was stale after the 1.1 migration: it had no `InterestLead`, so the new `submitInterest` tests failed with `tx.interestLead` undefined until `pnpm prisma generate` was run by hand (found at 7.2). Make `pnpm test` (global setup) or a `pretest`/`postinstall` script regenerate the client, and verify a fresh checkout runs `pnpm test` without a manual generate
- [ ] 10.10 `submitInterest` cannot rate-limit a request whose client IP is unknown (no `x-forwarded-for` / `x-real-ip`): it stores the lead unlimited (found at 7.2; same behavior as the login limiter). Decide whether to refuse or apply a global cap in that case, and confirm the production nginx always sets the header (DEPLOYMENT.md)
- [ ] 10.11 The rate-limit message ("Terlalu banyak pendaftaran dari jaringan ini, coba lagi nanti") and the generic "Data tidak valid" for tampered input are server-side only; the 7.3 form must show client-side field errors from `interestSchema` and surface these two messages as a form-level error (found at 7.2)

## 11. Mobile and tablet quality

Each check is done in the browser preview at 360px (phone), 768px (tablet portrait) and 1024px (tablet landscape): no horizontal page scroll, tap targets at least 44px, labels not truncated, on-screen keyboard does not hide the submit button, light and dark theme readable.

- [ ] 11.1 `/dashboard/pengaturan` (6.2): organization form, timezone select and level rename forms; verify at 360/768/1024, forms stack on phone and sit comfortably on tablet, saved/error messages visible without scrolling
- [ ] 11.2 Navigation: "Pengaturan" item in the mobile drawer and the collapsed desktop/tablet rail (tooltip, active state); verify drawer opens/closes with one hand reach and tablet keeps a usable sidebar
- [ ] 11.3 `/daftar` (7.3): form fields use correct `inputmode`/`autocomplete` (tel for WhatsApp), consent checkbox has a large tap area, success state's WhatsApp button is full-width on phone; verify at 360/768/1024
- [ ] 11.4 Landing and `/ormas` CTA to `/daftar` (7.3): CTA reachable above the fold on 360px; verify no layout shift or overflow
- [ ] 11.5 Keterangan in activity list and calendar (8.1): clamped text and the "full text" affordance work by tap (not only hover); verify at 360/768
- [ ] 11.6 Compact print (8.2): on-screen preview of `/dashboard/kegiatan/cetak` scrolls inside its own container on phone and the print button is reachable; verify at 360/768 and that print CSS only applies to `@media print`
- [ ] 11.7 Final sweep: walk every page touched by this change (login, pengaturan, daftar, kegiatan, cetak, absensi) at 360/768/1024 and record any defect as a new task in this section
