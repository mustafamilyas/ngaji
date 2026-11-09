import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/dashboard/anggota/actions", () => ({ createMemberAction: vi.fn() }));

import { QuickRegisterDialog } from "./quick-register-dialog";

// The dialog content renders in a portal that static markup leaves out, so the footer buttons are checked in the source.
const source = readFileSync(join(__dirname, "quick-register-dialog.tsx"), "utf8");

describe("QuickRegisterDialog touch sizes", () => {
  it("makes the trigger at least 44px tall below xl and compact from xl", () => {
    const html = renderToStaticMarkup(
      createElement(QuickRegisterDialog, {
        groupId: 3,
        groupName: "Kelompok A",
        occurrenceDate: "2026-10-18",
        today: "2026-10-18",
        onRegistered: () => {},
      }),
    );
    expect(html).toMatch(/<button[^>]*class="[^"]*\bmin-h-11\b[^"]*\bxl:min-h-10\b/);
    expect(html).not.toMatch(/(^|[\s"])h-10([\s"])/);
  });

  it("uses the large Button size for Batal and Daftar (44px below xl from the primitive), not a fixed 40px height", () => {
    expect(source).not.toMatch(/(^|[\s"])h-10([\s"])/);
    expect(source.match(/size="lg"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps every field 44px tall with 16px text", () => {
    expect(source).toMatch(/const inputClass =\s*"h-11 [^"]*\btext-base\b/);
  });
});
