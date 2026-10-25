import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/app/dashboard/actions", () => ({ signOutAction: vi.fn() }));

import { AppSidebar, BrandMark } from "./app-sidebar";

describe("BrandMark", () => {
  it("shows the organization name with the Dahan mark", () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { organizationName: "Pengajian Al-Ikhlas" }));
    expect(html).toContain("Pengajian Al-Ikhlas");
    expect(html).toContain("oleh Dahan");
    expect(html).not.toContain("Ngaji");
  });

  it("is at least 44px tall so it is a comfortable tap target", () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { organizationName: "Pengajian Al-Ikhlas" }));
    expect(html).toMatch(/<a[^>]*class="[^"]*\bmin-h-11\b/);
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
  it("never shrinks the collapse button below 44px wide on a docked sidebar", () => {
    const html = renderToStaticMarkup(
      createElement(AppSidebar, {
        organizationName: "Pengajian Al-Ikhlas",
        userName: "Budi",
        userRole: "OWNER",
        collapsed: false,
        onToggleCollapsed: () => {},
      }),
    );
    expect(html).toMatch(/<button[^>]*aria-label="Perkecil menu"[^>]*class="[^"]*\bshrink-0\b|<button[^>]*class="[^"]*\bshrink-0\b[^"]*"[^>]*aria-label="Perkecil menu"/);
  });

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

  const render = (isRootOwner: boolean) =>
    renderToStaticMarkup(
      createElement(AppSidebar, {
        organizationName: "Pengajian Al-Ikhlas",
        userName: "Budi",
        userRole: "OWNER",
        isRootOwner,
        collapsed: false,
        onToggleCollapsed: () => {},
      }),
    );

  it("shows the organization Pengaturan item only to a root owner", () => {
    expect(render(true)).toContain('href="/dashboard/pengaturan"');
    expect(render(false)).not.toContain('href="/dashboard/pengaturan"');
  });

  it("labels the account link Akun so Pengaturan is unambiguous", () => {
    const html = render(true);
    expect(html).toContain("Akun");
    expect(html.match(/Pengaturan/g)).toHaveLength(1);
  });

  it("gives Pengaturan and Akun different icons so the icon-only rail tells them apart", () => {
    const html = render(true);
    const iconOf = (href: string) => html.match(new RegExp(`href="${href}"[^>]*>\\s*<svg[^>]*class="([^"]*)"`))?.[1]?.split(" ")[1];
    expect(iconOf("/dashboard/pengaturan")).toBe("lucide-settings");
    expect(iconOf("/dashboard/akun/password")).toBe("lucide-user-round");
  });

  it("makes nav links 44px tall below xl and compact from xl", () => {
    const html = render(true);
    expect(html).toMatch(/class="[^"]*\bmin-h-11\b[^"]*\bxl:min-h-0\b[^"]*" href="\/dashboard\/kegiatan"/);
  });

  it("hides the scrollbar of the menu list so the collapsed rail keeps its tap width", () => {
    expect(render(true)).toContain("[scrollbar-width:none]");
  });

  it("scrolls only the menu list and pins Akun, Keluar and the user card below it", () => {
    const html = render(true);
    const menuStart = html.indexOf('data-nav-scroll="menu"');
    const footerStart = html.indexOf('data-nav-footer');
    expect(menuStart).toBeGreaterThan(-1);
    expect(footerStart).toBeGreaterThan(menuStart);
    const menuTag = html.slice(html.lastIndexOf("<", menuStart), html.indexOf(">", menuStart));
    expect(menuTag).toMatch(/\bmin-h-0\b/);
    expect(menuTag).toMatch(/\boverflow-y-auto\b/);
    const footerTag = html.slice(html.lastIndexOf("<", footerStart), html.indexOf(">", footerStart));
    expect(footerTag).toMatch(/\bshrink-0\b/);
    const footer = html.slice(footerStart);
    expect(footer).toContain("Keluar");
    expect(footer).toContain("Akun");
    expect(html.slice(menuStart, footerStart)).not.toContain("Keluar");
  });

  it("does not scroll the docked sidebar as a whole, so Keluar cannot scroll away", () => {
    const html = render(true);
    const asideTag = html.slice(html.indexOf("<aside"), html.indexOf(">", html.indexOf("<aside")));
    expect(asideTag).not.toMatch(/\boverflow-y-auto\b/);
  });
});
