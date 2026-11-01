import { describe, expect, it } from "vitest";
import { VIEW_MAX_SUMMARIES } from "@/lib/constants";
import { emptyDefinition, type Definition } from "@/lib/validation/member-view";
import type { Dimension } from "@/lib/validation/summary";
import {
  addSummary,
  choiceOfDimension,
  choiceShownFor,
  dimensionOfChoice,
  moveSummary,
  removeSummary,
  replaceSummaryDimension,
  summaryChoices,
} from "./summary-edit";

const sex: Dimension = { kind: "property", field: "sex" };
const status: Dimension = { kind: "property", field: "status" };
const withDims = (...dims: Dimension[]): Definition => ({ ...emptyDefinition(), summaries: dims.map((dimension) => ({ dimension })) });
const dims = (d: Definition) => (d.summaries ?? []).map((s) => s.dimension);

describe("summary list edits", () => {
  it("adds a sex summary at the end", () => {
    expect(dims(addSummary(withDims(status)))).toEqual([status, sex]);
    expect(dims(addSummary(emptyDefinition()))).toEqual([sex]);
  });

  it("does not add beyond VIEW_MAX_SUMMARIES", () => {
    const full = withDims(...Array.from({ length: VIEW_MAX_SUMMARIES }, () => sex));
    expect(addSummary(full)).toBe(full);
  });

  it("removes one and drops the key when none are left", () => {
    expect(dims(removeSummary(withDims(sex, status), 0))).toEqual([status]);
    expect(removeSummary(withDims(sex), 0).summaries).toBeUndefined();
  });

  it("moves a summary up or down and ignores moves past the ends", () => {
    const def = withDims(sex, status);
    expect(dims(moveSummary(def, 1, -1))).toEqual([status, sex]);
    expect(dims(moveSummary(def, 0, 1))).toEqual([status, sex]);
    expect(moveSummary(def, 0, -1)).toBe(def);
    expect(moveSummary(def, 1, 1)).toBe(def);
  });

  it("replaces the dimension of one summary only", () => {
    expect(dims(replaceSummaryDimension(withDims(sex, sex), 1, status))).toEqual([sex, status]);
  });

  it("never mutates its input", () => {
    const def = withDims(sex, status);
    const snapshot = structuredClone(def);
    addSummary(def);
    removeSummary(def, 0);
    moveSummary(def, 0, 1);
    replaceSummaryDimension(def, 0, status);
    expect(def).toEqual(snapshot);
  });
});

describe("dimension choices", () => {
  const levels = [{ depth: 1, name: "Cabang" }, { depth: 2, name: "Kelompok" }];
  const tags = [
    { id: 9, label: "prioritas:tinggi", key: "prioritas", value: "tinggi", groupId: 5 },
    { id: 8, label: "prioritas:rendah", key: "prioritas", value: "rendah", groupId: 5 },
    { id: 7, label: "prioritas:tinggi", key: "prioritas", value: "tinggi", groupId: 6 },
    { id: 4, label: "relawan", key: "relawan", value: null, groupId: 5 },
  ];

  it("round-trips every dimension kind through its select value", () => {
    const all: Dimension[] = [
      sex,
      { kind: "ageBuckets", buckets: [{ label: "Anak", min: 0, max: 12 }] },
      { kind: "groupLevel", depth: 2 },
      { kind: "tagKey", tagId: 8 },
      { kind: "tag", tagId: 4 },
    ];
    expect(choiceOfDimension(sex)).toBe("p:sex");
    expect(choiceOfDimension({ kind: "groupLevel", depth: 2 })).toBe("l:2");
    expect(choiceOfDimension({ kind: "tagKey", tagId: 8 })).toBe("k:8");
    expect(choiceOfDimension({ kind: "tag", tagId: 4 })).toBe("t:4");
    expect(choiceOfDimension(all[1])).toBe("age");
    for (const d of [sex, all[2], all[3], all[4]]) expect(dimensionOfChoice(choiceOfDimension(d))).toEqual(d);
  });

  it("starts age buckets from the standard brackets", () => {
    const dimension = dimensionOfChoice("age");
    expect(dimension?.kind).toBe("ageBuckets");
    expect(dimension?.kind === "ageBuckets" && dimension.buckets[0]).toEqual({ label: "Balita", min: 0, max: 5 });
  });

  it("rejects unknown or malformed select values", () => {
    for (const bad of ["", "x", "p:email", "l:abc", "k:", "t:-1", "p:"]) expect(dimensionOfChoice(bad)).toBeNull();
  });

  it("lists fields, age, levels and tags, with one entry per tag key per owner group", () => {
    const choices = summaryChoices(levels, tags);
    expect(choices.map((c) => c.value)).toEqual([
      "p:sex", "p:status", "p:maritalStatus", "p:workStatus", "age", "l:1", "l:2",
      "k:8", "k:7", "t:4",
    ]);
    expect(choices.find((c) => c.value === "k:8")).toMatchObject({ label: "Tag: prioritas" });
    expect(choices.find((c) => c.value === "l:2")?.label).toBe("Tingkat Kelompok");
    expect(choices.find((c) => c.value === "t:4")?.label).toBe("Tag: relawan");
  });

  it("shows a tag key under its anchor entry even when saved on another value of the key", () => {
    expect(choiceShownFor({ kind: "tagKey", tagId: 9 }, tags)).toBe("k:8");
    expect(choiceShownFor({ kind: "tagKey", tagId: 7 }, tags)).toBe("k:7");
    expect(choiceShownFor({ kind: "tagKey", tagId: 404 }, tags)).toBe("k:404");
    expect(choiceShownFor(sex, tags)).toBe("p:sex");
  });
});
