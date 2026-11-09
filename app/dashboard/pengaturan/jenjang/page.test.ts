import { describe, expect, it } from "vitest";
import LevelSettingsRedirect from "./page";

describe("LevelSettingsRedirect", () => {
  it("redirects the old level URL to /dashboard/pengaturan", () => {
    try {
      LevelSettingsRedirect();
      expect.unreachable("expected a redirect");
    } catch (error) {
      expect(error).toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
      expect((error as { digest: string }).digest).toContain("/dashboard/pengaturan;");
    }
  });
});
