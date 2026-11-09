import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { mockAuthSession, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { auth } from "@/auth";
import { updateActivityAction } from "./actions";

const validInput = {
  name: "Kajian",
  location: "Masjid",
  startTime: "19:00",
  durationMinutes: 60,
  freq: "ONCE",
  interval: 1,
  weekdays: [],
  startsOn: "2026-09-09",
  endsOn: "2026-09-09",
};

describe("updateActivityAction id validation", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("activityId 'abc' rejected with the generic validation error", async () => {
    mockAuthSession(auth, { user: sessionFor(1, "ADMIN", { id: 1, path: "1/", organizationId: 1 }) });

    const result = await updateActivityAction("abc", validInput);

    expect(result).toEqual({ ok: false, error: "Data tidak valid" });
  });
});
