import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The dialog content renders in a portal that static markup leaves out, so the structure is checked in the source.
const source = readFileSync(join(__dirname, "manage-user-dialog.tsx"), "utf8");

describe("ManageUserDialog on short screens", () => {
  it("has a pinned footer with a Tutup button, since the sections have no close button of their own", () => {
    const content = source.slice(source.indexOf("<DialogContent"), source.indexOf("</DialogContent>"));
    expect(content).toContain("<DialogFooter");
    const footer = content.slice(content.indexOf("<DialogFooter"), content.indexOf("</DialogFooter>"));
    expect(footer).toContain("<DialogClose");
    expect(footer).toContain("Tutup");
    // 44px below xl comes from the large Button size (task 10.23)
    expect(footer).toContain('size: "lg"');
  });

  it("puts the footer after the sections so they scroll above it", () => {
    const content = source.slice(source.indexOf("<DialogContent"));
    expect(content.indexOf("<DialogFooter")).toBeGreaterThan(content.indexOf("divide-y"));
  });

  it("scrolls the temporary password into view, clear of the pinned footer", () => {
    const form = source.slice(source.indexOf("function ResetPasswordForm"), source.indexOf("/** \"Kelola\" button"));
    expect(form).toContain("scrollIntoView");
    expect(form).toMatch(/useEffect\(/);
    expect(form).toMatch(/ref=\{resultRef\}/);
    // The sticky footer covers the bottom of the scroll area: leave room for it (footer is about 66px).
    expect(form).toMatch(/role="status"[^>]*className="[^"]*\bscroll-mb-20\b/);
  });
});
