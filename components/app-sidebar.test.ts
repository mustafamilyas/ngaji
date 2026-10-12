import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/app/dashboard-actions", () => ({ signOutAction: vi.fn() }));

import { AppSidebar, BrandMark } from "./app-sidebar";

describe("BrandMark", () => {
  it("shows the organization name with the Dahan mark", () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { organizationName: "Pengajian Al-Ikhlas" }));
    expect(html).toContain("Pengajian Al-Ikhlas");
    expect(html).toContain("oleh Dahan");
    expect(html).not.toContain("Ngaji");
  });

  it("keeps only the logo when collapsed, named after the organization", () => {
    const html = renderToStaticMarkup(
      createElement(BrandMark, { organizationName: "Pengajian Al-Ikhlas", withLabel: false }),
    );
    expect(html).toContain('aria-label="Pengajian Al-Ikhlas"');
    expect(html).not.toContain("oleh Dahan");
  });
});

describe("AppSidebar", () => {
  it("contains the organization name and no old product name", () => {
    const html = renderToStaticMarkup(
      createElement(AppSidebar, {
        organizationName: "Pengajian Al-Ikhlas",
        userName: "Budi",
        userRole: "OWNER",
        collapsed: false,
        onToggleCollapsed: () => {},
      }),
    );
    expect(html).toContain("Pengajian Al-Ikhlas");
    expect(html).not.toContain("Ngaji");
  });
});
