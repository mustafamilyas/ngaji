import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Bricolage_Grotesque: () => ({ variable: "", className: "" }),
}));

import { db } from "@/lib/db";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the landing page without touching the database", () => {
    const spy = vi.spyOn(db.organization, "findFirst");
    const html = renderToStaticMarkup(HomePage());
    expect(html).toContain("Dahan");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("Dasbor");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
