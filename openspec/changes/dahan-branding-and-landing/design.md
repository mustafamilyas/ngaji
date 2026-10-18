# Design

## Context

- One organization per deployment (DESIGN.md §1). Each org runs its own instance, so the landing page at `/` is served by every instance, alongside that instance's login.
- `proxy.ts` redirects every request without a session to `/login`, except `/login` itself. It also sets a per-request nonce CSP (DESIGN.md §4.3), so every page is dynamically rendered (`force-dynamic` in `app/layout.tsx`).
- `app/page.tsx` is the dashboard and calls `redirect("/login")` without a session; `app/page.test.ts` asserts that redirect.
- `NavShell` already renders a bare frame when `user` is undefined (as on `/login`).
- `whatsappNumber()` in `lib/member/whatsapp.ts` already normalizes Indonesian numbers.

## Goals / Non-Goals

**Goals:**
- Public pages work with the same proxy, CSP and layout, without loosening protection on any app route.
- Deciding which paths are public is a pure, unit-tested function.

**Non-Goals:**
- A separate marketing site, CMS, blog, i18n, SEO tooling beyond basic metadata, pricing, sign-up or demo accounts.
- Renaming the repo, package, database, cookies or code identifiers from `ngaji`.
- Configurable branding per org beyond `Organization.name` (no logo upload, no theme colors).

## Decisions

1. **Public paths as a pure allowlist.** `lib/auth/public-paths.ts` exports `isPublicPath(pathname)`. It matches exactly `/`, `/pengajian` and `/login`, with no prefix matching, so `/pengajian/x` or `/login/../anggota` don't slip through. The proxy calls it: without a session, a public path → `next()`, anything else → redirect to `/login`. The existing redirect of logged-in users away from `/login`, and the forced password change, stay before it. *Alternative:* a matcher exclusion in `config.matcher`. Rejected: it would skip the CSP nonce for those pages.

2. **`/` branches inside `app/page.tsx`.** No session → return `<LandingPage />`. With a session → the dashboard as today. The landing branch runs before any DB query. *Alternative:* a route group with a separate `/beranda` URL plus a rewrite. Rejected: more moving parts, and the root URL is what people share.

3. **Landing components are server components with static content.** They live in `components/landing/*` (hero, how-it-works, data-protection, CTA, footer), are shared by `/` and `/pengajian`, and take copy as props or constants. No client JS except what shadcn primitives need. The illustrations are inline SVG or icons from `lucide-react`, so the CSP doesn't change and nothing external is loaded.

4. **Public pages get their own chrome.** `NavShell` already renders a bare frame without a user. The landing page has its own top bar (logo + "Masuk") and footer inside the page. When a logged-in user visits `/pengajian`, the page renders inside the app shell. That's acceptable because it's static content, and it avoids a second layout tree.

5. **WhatsApp number from an environment variable.** `DAHAN_WHATSAPP` is read on the server at render time by `contactWhatsappUrl()` in `lib/landing/contact.ts`, which wraps `whatsappUrl()`. A missing or invalid value returns `null` and the CTA is hidden. It is not a `NEXT_PUBLIC_` variable, so it isn't inlined at build time and can be changed per deployment without a rebuild. *Alternative:* a constant in `lib/constants.ts`. Rejected: the number is deployment configuration, not a product constant.

6. **Organization name lookup.** `getOrganizationName()` in `lib/organization.ts` reads the single `Organization` row, wrapped in React `cache()` so it runs once per request, and falls back to `"Dahan"`. It is called by `app/layout.tsx` (passed to `NavShell` → `BrandMark`) only when there is a session or the path is `/login`. `app/login/page.tsx` calls it too, and so does `generateMetadata` for title templates. The landing page never calls it (spec: no org data on public pages). The layout learns whether it's on a public page because the proxy sets an `x-pathname` request header next to `x-nonce`.

7. **Title template.** The root `metadata` becomes `title: { default: "Dahan", template: "%s · Dahan" }` for public pages. App pages use `generateMetadata` in the layout, giving `%s · <org name>` with default `<org name> · Dahan` when a session exists.

8. **Logo.** A simple branch/leaf mark as inline SVG in `components/brand/logo.tsx` (used in the sidebar, landing page and login), plus `app/icon.svg`, replacing `favicon.ico` through the Next file convention. The "N" letter tile is removed.

## Risks / Trade-offs

- [The allowlist accidentally exposes an app route] → exact-match function with unit tests covering negatives (`/anggota`, `/pengajian/1`, `/Login`, trailing slash). An integration test asserts `/anggota` still redirects.
- [The landing page gets indexed on every org's subdomain (duplicate content)] → acceptable for now. Each instance can later set `robots` noindex through an env flag; recorded as an open question.
- [`x-pathname` header spoofing] → the proxy always overwrites it, and it only decides whether the org name is shown, never authorization.
- [Copy goes stale against features] → copy lives in one constants file per page, so it's easy to edit.

## Migration Plan

Deploy as usual (DEPLOYMENT.md), then set `DAHAN_WHATSAPP` in the environment file of the instance that should show the CTA. Rollback: redeploy the previous build. No data migration.

## Open Questions

- Should non-primary instances (customer subdomains) send `noindex`? This can be added later as an env flag without changing the specs.
