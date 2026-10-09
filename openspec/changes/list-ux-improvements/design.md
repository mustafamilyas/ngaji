# Design

## Filters are plain GET forms (`next/form`)
Each control is a real form field and submits on change, so filter state is the URL contract parsed by `lib/filters.ts` and pages stay Server Components. `next/form` gives client-side navigation without `useRouter`, which keeps pages renderable in Vitest (`renderToStaticMarkup` has no router). Popover content is portaled out of the form, so pickers write into hidden inputs inside the form and then `requestSubmit()`.

## Group filter semantics differ by page, on purpose
Members, users and audit: a group means "this group and its descendants" (`path startsWith`), unioned across selections. Kegiatan keeps §5.3 ("activities that apply to the group", including ancestors') and its drop-out-of-scope-ids behaviour. Statistics stay single-group because their breakdowns are per direct sub-group of one scope group.

## Date range model
`range` is a preset (`hari`, `minggu`, `bulan`, `7h`, `30h`, `90h`, `semua`) anchored at `anchor` (default today), or `custom` with `from`/`to`. Each page lists its allowed presets and default in `lib/constants.ts`. Bare `from`/`to` without `range` is read as custom so old links keep working. Labels are formatted by hand, not `Intl.formatRange`, whose spacing differs between Node and browsers and broke hydration.

## Pagination
Queries count first, clamp the page, then fetch. Computed lists (expanded occurrences) paginate in memory; client-sorted tables paginate in the browser after sorting. The pager renders nothing for a single page.

## Member columns and PII
The choice lives in an httpOnly cookie set by a Server Action (which refreshes the route). Only chosen columns are rendered server-side, so e.g. addresses are not in the HTML unless shown. It is a UI preference, not domain data, so it is not audited.

## WhatsApp
`Member.phone` is free text; it is normalized to an international number (Indonesian forms → 62…, others only with "+"), and unusable numbers produce no link rather than a possibly wrong one.
