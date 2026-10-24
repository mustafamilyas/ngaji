import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ActivityForm } from "./activity-form";

const create = () => renderToStaticMarkup(createElement(ActivityForm, { mode: "create", today: "2026-01-01" }));

function tag(html: string, id: string): string {
  return html.match(new RegExp(`<(?:input|select|textarea)[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? "";
}

function classOf(t: string): string {
  return t.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("ActivityForm phone and tablet layout", () => {
  it("every field is 44px with 16px text below xl", () => {
    const html = create();
    for (const id of ["name", "location", "startTime", "durationMinutes", "freq", "interval", "startsOn", "endsOn"]) {
      const cls = classOf(tag(html, id));
      expect(cls, id).toContain("h-11");
      expect(cls, id).toContain("text-base");
      expect(cls, id).not.toMatch(/(^|\s)h-9(\s|$)/);
    }
  });

  it("the notes textarea keeps 16px text", () => {
    expect(classOf(tag(create(), "notes"))).toContain("text-base");
  });

  it("the monthly day field is 44px with 16px text", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityForm, {
        mode: "edit",
        activityId: 1,
        defaultValues: {
          name: "A",
          location: "B",
          notes: undefined,
          startTime: "19:00",
          durationMinutes: 60,
          freq: "MONTHLY",
          interval: 1,
          weekdays: [],
          monthDay: 5,
          startsOn: "2026-01-01",
          endsOn: undefined,
        },
      }),
    );
    const cls = classOf(tag(html, "monthDay"));
    expect(cls).toContain("h-11");
    expect(cls).toContain("text-base");
  });

  it("weekday rows are 44px tall with a 20px checkbox", () => {
    const html = create();
    const rows = html.match(/<label[^>]*>(?:(?!<\/label>).)*type="checkbox"(?:(?!<\/label>).)*<\/label>/g) ?? [];
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row).toContain("min-h-11");
      expect(row).toMatch(/<input[^>]*class="[^"]*size-5/);
    }
  });

  it("Simpan is 44px and full width on phones", () => {
    const html = create();
    const button = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    expect(button).toContain("h-11");
    expect(button).toContain("w-full");
  });
});
