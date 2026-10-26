import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { DeleteMemberForm } from "./[id]/delete-member-form";
import { MemberForm } from "./member-form";

const create = () =>
  renderToStaticMarkup(
    createElement(MemberForm, { mode: "create", leafGroups: [], today: "2026-01-01" }),
  );

const edit = () =>
  renderToStaticMarkup(
    createElement(MemberForm, {
      mode: "edit",
      memberId: 1,
      defaultValues: {
        name: "Budi",
        birthPlace: "",
        birthDate: "",
        sex: "L",
        address: "",
        phone: "",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        email: undefined,
        status: "KELUAR",
        joinedAt: "2026-01-01",
        exitedAt: "2026-02-01",
      },
    }),
  );

function tag(html: string, id: string): string {
  return html.match(new RegExp(`<(?:input|select|textarea)[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? "";
}

function classOf(t: string): string {
  return t.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("MemberForm phone and tablet layout", () => {
  it.each([["create", create], ["edit", edit]] as const)(
    "%s: every field is 44px with 16px text below xl",
    (_mode, render) => {
      const html = render();
      for (const id of ["name", "birthPlace", "birthDate", "sex", "phone", "maritalStatus", "workStatus", "email", "status", "joinedAt"]) {
        const cls = classOf(tag(html, id));
        expect(cls, id).toMatch(/\bh-11\b/);
        expect(cls, id).toMatch(/\btext-base\b/);
        expect(cls, id).toMatch(/\bxl:h-9\b/);
      }
      const address = classOf(tag(html, "address"));
      expect(address).toMatch(/\btext-base\b/);
      expect(address).toMatch(/\bmin-h-24\b/);
    },
  );

  it("shows the exit date field at 44px when the member has left", () => {
    expect(classOf(tag(edit(), "exitedAt"))).toMatch(/\bh-11\b/);
  });

  it("sets the right keyboard and autofill hints", () => {
    const html = create();
    expect(tag(html, "phone")).toMatch(/type="tel"/);
    expect(tag(html, "phone")).toMatch(/inputMode="tel"/);
    expect(tag(html, "phone")).toMatch(/autoComplete="off"/);
    expect(tag(html, "email")).toMatch(/inputMode="email"/);
    expect(tag(html, "email")).toMatch(/autoComplete="off"/);
    expect(tag(html, "name")).toMatch(/autoComplete="off"/);
    expect(tag(html, "birthPlace")).toMatch(/autoComplete="off"/);
    expect(tag(html, "address")).toMatch(/autoComplete="off"/);
  });

  it("makes the submit button full width and 48px below xl", () => {
    const button = create().match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    const cls = classOf(button);
    expect(cls).toMatch(/\bw-full\b/);
    expect(cls).toMatch(/\bh-12\b/);
    expect(cls).toMatch(/\bxl:h-9\b/);
    expect(cls).toMatch(/\bxl:w-auto\b/);
  });

  it.each([["create", create], ["edit", edit]] as const)(
    "%s: the action bar sticks to the bottom below xl and is plain from xl",
    (_mode, render) => {
      const html = render();
      const bar = classOf(html.match(/<div[^>]*>(?=<button[^>]*type="submit")/)?.[0] ?? "");
      expect(bar).toMatch(/\bsticky\b/);
      expect(bar).toMatch(/\bbottom-0\b/);
      expect(bar).toMatch(/\bborder-t\b/);
      expect(bar).toMatch(/\bbg-background\/95\b/);
      // flush with the card edges (card spacing is 16px)
      expect(bar).toMatch(/(^| )-mx-4( |$)/);
      expect(bar).toMatch(/\bxl:static\b/);
      expect(bar).toMatch(/\bsm:col-span-2\b/);
    },
  );

  it("makes the delete button 44px below xl", () => {
    const html = renderToStaticMarkup(createElement(DeleteMemberForm, { memberId: 1 }));
    const button = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    expect(classOf(button)).toMatch(/\bh-11\b.*\bxl:h-8\b/);
  });

  it("keeps the form a single column on phones", () => {
    expect(create()).toMatch(/<form[^>]*class="[^"]*\bgrid\b[^"]*\bsm:grid-cols-2\b/);
  });
});
