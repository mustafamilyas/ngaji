# Proposal

## Why

The product is being positioned as a generic tool for hierarchical organizations, with pengajian as the first customer segment. "Ngaji" ties the brand to one segment, so the product is renamed **Dahan** ("tree branch" — the group hierarchy in DESIGN.md §1). Today every logged-out visit redirects to `/login`, so there is nowhere to explain the product to a prospective organization or to reach the maintainer.

## What Changes

- Rename user-facing "Ngaji" to "Dahan". Inside the app the organization's own name (`Organization.name`) is the primary label, with a small "oleh Dahan" mark (sidebar, login page, browser tab title). Repo, package and code identifiers stay `ngaji`.
- **BREAKING (routing):** a logged-out visit to `/` renders a public landing page instead of redirecting to `/login`. Logged-in users still get the dashboard at `/`. Every other non-public route still redirects to `/login`.
- New public segment page `/pengajian` with pengajian-specific copy.
- Landing copy in Bahasa Indonesia, mobile-first. It covers four points: a kegiatan set once at the top applies to every group below it; attendance (absensi) is taken from a phone; statistics roll up to the top; member data is protected (audit log, no hard delete, separate data per organization, UU PDP).
- Primary CTA "Hubungi via WhatsApp". The number comes from configuration, not from code; if it is not configured, the CTA is hidden.
- No pricing, billing or multi-tenancy (self-funded side project).
- Public pages read no database data and load no third-party trackers or scripts.
- DESIGN.md title, §7 page table, and the CLAUDE.md product line are updated in the same change.

## Capabilities

### New Capabilities
- `landing-page`: public marketing pages (`/` for logged-out visitors, `/pengajian`), WhatsApp CTA configuration, privacy constraints on public pages.
- `branding`: product name, organization-name-first labeling in the app shell, login page and document title.

### Modified Capabilities
- None in `openspec/specs/` (no archived specs yet). The authentication rule "unauthenticated requests redirect to `/login`" from `ngaji-mvp/specs/authentication` gains public-route exceptions, which are specified in `landing-page`.

## Impact

- `proxy.ts`: public-route allowlist (`/`, `/pengajian`, static assets) alongside `/login`.
- `app/page.tsx`: branches on session (landing vs dashboard); new landing components under `components/landing/`, new route `app/pengajian/page.tsx`.
- `app/layout.tsx`, `components/app-sidebar.tsx`, `app/login/page.tsx`: branding; a cached org-name lookup in `lib/`.
- `lib/constants.ts` / env (`DAHAN_WHATSAPP`): contact number; documented in DEPLOYMENT.md.
- `public/`: Dahan logo mark and favicon.
- CSP (DESIGN.md §4.3) unchanged: no external origins added.
- Docs: DESIGN.md, CLAUDE.md, README.md.
