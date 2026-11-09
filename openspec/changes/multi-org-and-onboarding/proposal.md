# Proposal

## Why

Dahan is moving from one organization per deployment (DESIGN.md §1) to one app hosting several organizations. Today the login page shows the single org's name, prospects can only open a bare WhatsApp link, adding an org requires `pnpm bootstrap` on an empty DB, and the org's name and timezone are fixed. Activity owners also want per-date details (teacher, material) where people read the schedule, and the printout is too long.

## What Changes

- **Multi-organization in one app.** Several orgs share one app and one SQLite DB. Usernames stay globally unique; a user's org is the org of their group. Everything org-wide (name, timezone, levels) resolves from the signed-in user's org, never from "the first org". **BREAKING** for DESIGN.md §1 ("Tenancy").
- **Generic login.** `/login` shows Dahan branding only, with no org name in the page or the title. A deployment flag `LOGIN_SHOW_ORG_NAME=true` brings the org name back for single-org deploys. It applies only when exactly one org exists.
- **Interest sign-up.** A new public page `/daftar` has a form: name, WhatsApp number, organization name, approximate member count (optional), message (optional) and a required consent checkbox. Submissions are stored as leads, then the visitor goes to WhatsApp (`DAHAN_WHATSAPP`) with the details prefilled. The landing and `/ormas` contact CTA now points to `/daftar` instead of opening WhatsApp directly. Submissions are protected by a per-IP rate limit and a honeypot field.
- **Leads CLI.** `pnpm leads` lists stored leads (table or CSV) for the maintainer. There is no web UI for leads.
- **Org provisioning CLI.** `pnpm org:create` creates an org with its levels, root group and first OWNER on an empty or non-empty DB. Configured by environment variables, like the current bootstrap. `pnpm bootstrap` stays as an alias.
- **Org settings.** `/dashboard/pengaturan` lets the root OWNER (OWNER whose group is depth 0) change the org name, the timezone (WIB `Asia/Jakarta`, WITA `Asia/Makassar`, WIT `Asia/Jayapura`) and the level names. The existing `/dashboard/pengaturan/jenjang` page folds into this page. A nullable `Organization.logoUrl` column is added but not editable or rendered yet.
- **Per-org timezone.** "Today" and timestamp display (attendance ≤ today, default ranges, statistics, audit log) use the user's org timezone instead of the hardcoded `Asia/Jakarta`. Stored dates and times are not converted.
- **Occurrence Keterangan everywhere.** The existing per-date notes (`overrideNotes`, falling back to the activity's notes) are shown in the activity list rows and the calendar view, in addition to the print page. Who may edit them is unchanged (§3.2: ≥ ADMIN in the owner group).
- **Compact print.** `/dashboard/kegiatan/cetak` renders one table for the whole range, with a Tanggal column shown once per day, a single header row repeated per printed page, and tighter type and spacing.

## Capabilities

### New Capabilities
- `multi-organization`: org resolution from the user, data isolation between orgs, and the generic login with its flag.
- `organization-provisioning`: the `org:create` CLI and the first OWNER.
- `interest-signup`: `/daftar` form, lead storage, abuse protection, WhatsApp handoff, `pnpm leads`.
- `organization-settings`: root OWNER settings page (name, timezone, levels), the `logoUrl` placeholder, and per-org timezone semantics.
- `occurrence-notes-display`: Keterangan on the activity list and calendar.

### Modified Capabilities
- `branding`: the login page no longer shows the org name (flagged), titles use the user's org, and the fallback applies per user.
- `landing-page`: `/daftar` joins the public allowlist; the CTA links to `/daftar`; public pages may write a lead but still render no org data.
- `activity-schedule-print`: single-table layout; header org name is the user's org.

## Impact

- Prisma: `Organization.logoUrl String?`, a new `InterestLead` model, and a migration. The timezone values go through a zod enum.
- Code: `lib/organization.ts`, `lib/dates.ts` and all `today()`/`dateOf()` callers, login, layouts, `pengaturan`, `kegiatan` list/calendar/print, landing, `lib/auth/public-paths.ts`, `prisma/bootstrap.ts`, new leads script, seed (second org).
- authz: new action `organization.update`. Audit: `organization.update`, `lead.create`.
- Docs: DESIGN.md §1, §2, §3.2, §7, §8, §10; DEPLOYMENT.md; `openspec/config.yaml` context.
