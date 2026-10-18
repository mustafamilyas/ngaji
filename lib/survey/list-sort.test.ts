import { describe, expect, it } from "vitest";
import { sortSurveys } from "./list-sort";

const survey = (id: number, title: string, groupName: string, responseCount: number, day: number) => ({
  id,
  title,
  group: { name: groupName },
  responseCount,
  createdAt: new Date(Date.UTC(2026, 0, day)),
});

describe("sortSurveys", () => {
  const surveys = [survey(1, "Ramadhan", "Desa B", 3, 1), survey(2, "Akhlak", "Desa A", 9, 2), survey(3, "Bacaan", "Desa A", 3, 3)];
  const ids = (key: Parameters<typeof sortSurveys>[1]["key"], dir: "asc" | "desc") =>
    sortSurveys(surveys, { key, dir }).map((s) => s.id);

  it("orders by creation date, newest first by default tie-break", () => {
    expect(ids("dibuat", "desc")).toEqual([3, 2, 1]);
    expect(ids("dibuat", "asc")).toEqual([1, 2, 3]);
  });

  it("orders by title", () => {
    expect(ids("judul", "asc")).toEqual([2, 3, 1]);
    expect(ids("judul", "desc")).toEqual([1, 3, 2]);
  });

  it("orders by owning group, ties newest first", () => {
    expect(ids("grup", "asc")).toEqual([3, 2, 1]);
  });

  it("orders by response count, ties newest first, without mutating the input", () => {
    expect(ids("respons", "desc")).toEqual([2, 3, 1]);
    expect(surveys.map((s) => s.id)).toEqual([1, 2, 3]);
  });
});
