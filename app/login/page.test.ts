import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./login-form", () => ({ LoginForm: () => null }));
vi.mock("@/lib/organization", () => ({ getOrganizationName: vi.fn() }));

import { getOrganizationName } from "@/lib/organization";
import LoginPage from "./page";

async function render() {
  return renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
}

describe("LoginPage branding", () => {
  beforeEach(() => vi.mocked(getOrganizationName).mockReset());

  it("shows the organization name and the Dahan mark above the form", async () => {
    vi.mocked(getOrganizationName).mockResolvedValue("Pengajian Al-Ikhlas");
    const html = await render();
    expect(html).toContain("Pengajian Al-Ikhlas");
    expect(html).toContain("oleh Dahan");
    expect(html).not.toContain("Ngaji");
  });

  it("falls back to Dahan when the deployment has no organization yet", async () => {
    vi.mocked(getOrganizationName).mockResolvedValue("Dahan");
    const html = await render();
    expect(html).toContain("Dahan");
    expect(html).toContain("Masuk");
  });
});
