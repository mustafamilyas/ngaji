import { describe, expect, it } from "vitest";
import { scheduleLabel } from "./labels";

describe("scheduleLabel", () => {
  it("names weekly days in order given", () => {
    expect(scheduleLabel({ freq: "WEEKLY", interval: 1, weekdays: [1, 4], monthDay: null })).toBe(
      "Mingguan · Senin, Kamis",
    );
    expect(scheduleLabel({ freq: "WEEKLY", interval: 2, weekdays: [0], monthDay: null })).toBe(
      "Tiap 2 minggu · Minggu",
    );
  });

  it("covers daily, monthly and once", () => {
    expect(scheduleLabel({ freq: "DAILY", interval: 1, weekdays: [], monthDay: null })).toBe("Harian");
    expect(scheduleLabel({ freq: "DAILY", interval: 3, weekdays: [], monthDay: null })).toBe("Tiap 3 hari");
    expect(scheduleLabel({ freq: "MONTHLY", interval: 1, weekdays: [], monthDay: 15 })).toBe("Bulanan, tanggal 15");
    expect(scheduleLabel({ freq: "ONCE", interval: 1, weekdays: [], monthDay: null })).toBe("Sekali");
  });
});
