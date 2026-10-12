# Tasks

## 1. Pure logic (tests first)

- [x] 1.1 Add `isPublicPath(pathname)` in `lib/auth/public-paths.ts` with tests: `/`, `/pengajian`, `/login` → true; `/anggota`, `/pengajian/1`, `/Login`, `/pengajian/`, `/api/x` → false. Verify with `pnpm test lib/auth/public-paths`.
- [x] 1.2 Add `contactWhatsappUrl()` in `lib/landing/contact.ts` (reads `DAHAN_WHATSAPP`, reuses `whatsappUrl`) with tests for a configured, missing and invalid number. Verify with `pnpm test lib/landing`.
- [x] 1.3 Add `getOrganizationName()` in `lib/organization.ts` (React `cache`, fallback `"Dahan"`) with tests for an existing org and an empty table. Verify with `pnpm test lib/organization`.

## 2. Routing

- [x] 2.1 Update `proxy.ts`: without a session, `isPublicPath` → next, otherwise redirect to `/login`; set the `x-pathname` request header; keep the forced-password-change and logged-in-on-`/login` redirects. Verify manually: `/` and `/pengajian` return 200 when logged out; `/anggota` redirects to `/login`.
- [x] 2.2 Update `app/page.tsx` to render the landing page when there is no session, before any DB query. Update `app/page.test.ts`: the no-session case renders the landing page and makes no DB call; the logged-in case is unchanged. Verify with `pnpm test app/page`.

## 3. Branding

- [x] 3.1 Add the Dahan logo (`components/brand/logo.tsx` inline SVG) and `app/icon.svg`; remove the "N" tile and `favicon.ico`. Verify the favicon in the browser tab.
- [x] 3.2 Pass the org name from `app/layout.tsx` to `NavShell`/`BrandMark` (org name plus "oleh Dahan"; collapsed rail shows the logo with the org name as `aria-label`). Verify with a render test that the sidebar contains the org name and no "Ngaji".
- [x] 3.3 Show the org name and "oleh Dahan" on `app/login/page.tsx`. Verify with a render test, including the empty-org fallback.
- [x] 3.4 Title metadata: public pages use `%s · Dahan`; app pages and login use the org name (`generateMetadata`). Verify the tab titles for `/` (logged out), `/login` and the dashboard in the browser.

## 4. Landing pages

- [x] 4.1 Build `components/landing/*` (top bar with logo + Masuk, hero, how it works, data protection, CTA, footer) as server components with copy in constants. Verify a render test asserts the sections, the `/login` and `/pengajian` links, and no "harga" (pricing).
- [x] 4.2 Build the generic landing page used by `/`. Verify the render test, plus a test with a seeded org asserting that the org and group names are absent from the HTML.
- [x] 4.3 Build `app/pengajian/page.tsx` with pengajian copy (jamaah, pengurus, pusat/daerah/desa/kelompok, pengajian rutin) and the same CTA. Verify with a render test.
- [x] 4.4 Run a browser check at 360px and desktop widths: no horizontal scroll, CTA tappable, all network requests same-origin, no CSP console errors.

## 5. Docs & wrap-up

- [ ] 5.1 Update DESIGN.md (title → Dahan, §7 table rows for `/` logged out and `/pengajian`, public-route note in §4), CLAUDE.md product line, README.md, and `DAHAN_WHATSAPP` in DEPLOYMENT.md. Verify `grep -rn "Ngaji" app components` returns nothing user-facing.
- [ ] 5.2 Run `pnpm lint && pnpm tsc --noEmit && pnpm test`; all pass.
