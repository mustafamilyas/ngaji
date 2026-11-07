# Design

## Context

See proposal.md - Why. `FilterBar` is one GET form whose controls submit on change. Controls find the form through `closest("form")` (`submitFilterForm`). `components/ui/sheet.tsx` renders through a portal, so a control inside it would leave the form. `ColumnToggle` sits outside `FilterBar` and has its own form, rendered in a portaled popover.

`FilterBar` is also used on detail tabs and Statistik. Those keep their current layout.

## Goals / Non-Goals

**Goals:** fix the three shared causes centrally, and make regressions fail the audit.

**Non-Goals:** changing URL parameters or filter meaning; redesigning detail pages or the landing page; changing touch sizes in `components/ui`. Section 6 of tasks.md (follow-ups from the member-csv-import review) adds the Tampilan apply step and admin check-in on future dates; their decisions are below.

## Decisions

### 1. An in-form panel, not the portaled Sheet
`FilterBar` gains an opt-in `more` slot and an `activeCount` prop. `more` renders once, inside the form. Below `lg` it is a fixed bottom panel; from `lg` it uses `lg:contents`, so its controls flow inline as they do today.

Alternatives:
- **Sheet with `form=` attributes:** needs a second rendering for desktop, or a JS media query with a hydration flash.
- **Native `<dialog>`:** stays in the form, but its top layer would hide the portaled Group, Tag, and date popovers.

The cost is that the panel handles its own Escape, backdrop, focus return, and scroll lock. That is a small amount of code, covered by a jsdom test. Popover z-index must sit above the panel.

### 2. Keep apply-on-change
The panel keeps auto-submit, with no "Terapkan" step. Open state lives in `FilterBar`, which survives same-route navigation, so the panel stays open. This needs confirming in the browser, because `FilterBar` must not be remounted by a `key` on the page.

### 3. Column picker joins the panel
`ColumnToggle` moves into `more`. Its form is portaled, so the DOM has no nested form. Check for a React nesting warning and that its trigger does not submit the filter form.

### 4. Scoped token override for text size
Tailwind's `text-xs` reads `--text-xs`. Override it in `globals.css`:

```css
@media screen and (max-width: 1279.98px) {
  :root:has([data-dashboard]) { --text-xs: 0.875rem; --text-xs--line-height: 1.25rem; }
}
```

- `:root:has()` also reaches popups portaled to `body`.
- `screen` keeps print unchanged; an A4 page would otherwise match `max-width`.
- `[data-dashboard]` on the dashboard layout keeps the landing page unchanged.

Editing 137 call sites was rejected: it is noisy and does not stop new ones. If the override fails under `@theme inline`, the fallback is a `text-label` utility and a codemod over `app/dashboard` and `components`.

`text-xs` and `text-sm` become equal below `xl`, so hierarchy there relies on colour and weight.

### 5. Audit additions
- `collector.js` walks visible text nodes and reports those under 14px. It skips SVG, `.sr-only`, and `[data-small-text-ok]`.
- New finding kinds are `read-text-size` and `first-record`.
- `first-record` runs only at the audit's phone size (360×740) on the five list pages, finds rows through a `data-records` marker on each list's `<tbody>`, and uses the bulk seed the audit already has. The audit's Chrome reserves a classic scrollbar, so it is stricter than a phone.

### 6. Tampilan: one local draft per open panel
A small `useDraft` hook copies the definition when a panel opens; edits change only that copy, and closing or "Terapkan" applies it in one navigation (`?d=`), so the server re-validates once instead of per edit. The toolbar keeps the last applied definition in `useOptimistic`, so a chip-row click right after a panel closes builds on the change just applied, not on the props of the previous render.

Alternatives:
- **Apply only on "Terapkan" and discard on close:** rejected by the owner; closing is the common way out on phones.
- **Keep apply-on-change and debounce:** the result would still change while editing, which is the complaint.

## Risks / Trade-offs

- [Larger text breaks tight layouts such as calendar cells and tiles] → the audit plus a screenshot pass; mark true exceptions `data-small-text-ok`.
- [Hidden filters are forgotten] → the count on the button and its active style.
- [The 600px limit is tight on Anggota, estimated at about 545px] → measure after the tile change; do not lower the limit silently.
- [`:has()` on old browsers] → they keep 12px text; nothing breaks.

## Migration Plan

UI only, with no data migration. Roll back by reverting the commit.
