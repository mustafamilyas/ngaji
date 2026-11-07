/**
 * Click-through flows of the viewport audit: states that only exist after an interaction (an open tag
 * picker, the bulk bar, a dialog). Declarative on purpose: the runner in `scenario-runner.ts` is generic.
 */
import type { Role } from "./args";
import type { SeedIds, Viewport } from "./pages";

/** What the tag task names: a current phone, a small tablet and a landscape phone. */
export const SCENARIO_VIEWPORTS: Viewport[] = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 812, height: 375 },
];

/** An element found by CSS selector, optionally narrowed to the first whose text contains `text`. */
export type Target = { selector: string; text?: string };

export type Step =
  | { click: Target; measure?: string }
  | { key: "Escape" }
  | { measure: string };

export type Scenario = {
  name: string;
  /** Seeded account the flow runs as (tag management needs the admin of the tag's group). */
  role: Role;
  path: string;
  steps: Step[];
};

const button = (label: string): Target => ({ selector: `button[aria-label="${label}"]` });
const pickerTrigger: Target = { selector: 'button[aria-label^="Atur tag"]' };
/** "Filter" button of a list's filter bar; every scenario size is below `lg`, where secondary filters are in its panel. */
const filterPanelButton: Target = { selector: 'form[role="search"] button[aria-expanded]', text: "Filter" };

export function buildScenarios(ids: SeedIds): Scenario[] {
  const scenarios: Scenario[] = [
    {
      name: "member row tag picker",
      role: "admin",
      path: "/dashboard/anggota",
      steps: [{ click: pickerTrigger, measure: "picker open" }],
    },
    {
      name: "bulk tag bar",
      role: "admin",
      path: "/dashboard/anggota",
      steps: [
        { click: { selector: '[role="checkbox"][aria-label^="Pilih "]:not([aria-label^="Pilih semua"])' }, measure: "one row selected" },
        { click: button("Tambah tag"), measure: "add chooser open" },
      ],
    },
    {
      name: "member header menu",
      role: "admin",
      path: "/dashboard/anggota",
      steps: [{ click: button("Aksi untuk daftar anggota"), measure: "menu open" }],
    },
    {
      name: "import column help",
      role: "admin",
      path: "/dashboard/anggota/impor",
      steps: [{ click: { selector: "summary", text: "Format kolom" }, measure: "help open" }],
    },
    {
      name: "member tag filter",
      role: "admin",
      path: "/dashboard/anggota",
      steps: [
        { click: filterPanelButton, measure: "panel open" },
        { click: { selector: '[data-slot="tag-filter"]' }, measure: "filter open" },
      ],
    },
    {
      name: "statistik per tag picker",
      role: "admin",
      path: "/dashboard/statistik?tab=anggota",
      steps: [{ click: { selector: 'section[aria-labelledby="per-tag"] button[aria-label="Pilih tag"]' }, measure: "picker open" }],
    },
    {
      name: "statistik rincian picker",
      role: "admin",
      path: "/dashboard/statistik?tab=kegiatan&rincian=sex",
      steps: [{ click: { selector: 'button[aria-label^="Rincian menurut"]' }, measure: "picker open" }],
    },
    {
      name: "activity list tag picker",
      role: "admin",
      path: "/dashboard/kegiatan",
      steps: [{ click: pickerTrigger, measure: "picker open" }],
    },
    {
      name: "activity tag filter",
      role: "admin",
      path: "/dashboard/kegiatan",
      steps: [
        { click: filterPanelButton, measure: "panel open" },
        { click: { selector: '[data-slot="tag-filter"]' }, measure: "filter open" },
      ],
    },
  ];

  if (ids.memberId !== null) {
    scenarios.push({
      name: "member detail tag picker",
      role: "admin",
      path: `/dashboard/anggota/${ids.memberId}`,
      steps: [{ click: pickerTrigger, measure: "picker open" }],
    });
  }
  if (ids.activityId !== null) {
    scenarios.push({
      name: "activity detail tag picker",
      role: "admin",
      path: `/dashboard/kegiatan/${ids.activityId}`,
      steps: [{ click: pickerTrigger, measure: "picker open" }],
    });
  }
  if (ids.branchGroupId !== null) {
    const menu: Target = { selector: '[aria-label^="Aksi untuk"]' };
    scenarios.push({
      name: "group tag tab",
      role: "admin",
      path: `/dashboard/grup/${ids.branchGroupId}?tab=tag`,
      steps: [
        { measure: "tab" },
        { click: { selector: "button", text: "Tag baru" }, measure: "new tag dialog" },
        { key: "Escape" },
        { click: menu, measure: "tag menu" },
        { click: { selector: '[role="menuitem"]', text: "Ubah warna" }, measure: "recolor dialog" },
        { key: "Escape" },
        { click: menu },
        { click: { selector: '[role="menuitem"]', text: "Hapus" }, measure: "delete dialog" },
      ],
    });
  }
  if (ids.viewId !== null) {
    scenarios.push({
      name: "tampilan menu",
      role: "owner",
      path: `/dashboard/tampilan/${ids.viewId}`,
      steps: [
        { click: { selector: "button", text: "Tampilan" }, measure: "menu open" },
        { click: { selector: "button", text: "Tambah ringkasan" }, measure: "summary added" },
      ],
    });
  }
  return scenarios;
}
