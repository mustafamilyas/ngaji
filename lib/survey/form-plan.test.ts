import { describe, expect, it } from "vitest";
import { surveyFormSchema, type SurveyFormInput } from "@/lib/validation/survey";
import { planFormUpdate, type CurrentForm } from "./form-plan";

const current: CurrentForm = {
  questions: [
    {
      id: 1,
      type: "SINGLE_CHOICE",
      scaleMin: null,
      scaleMax: null,
      archived: false,
      options: [
        { id: 10, archived: false },
        { id: 11, archived: false },
        { id: 12, archived: true },
      ],
    },
    { id: 2, type: "SCALE", scaleMin: 1, scaleMax: 5, archived: false, options: [] },
    { id: 3, type: "SHORT_TEXT", scaleMin: null, scaleMax: null, archived: false, options: [] },
  ],
};

const q1 = {
  id: 1,
  type: "SINGLE_CHOICE",
  label: "Hadir?",
  required: true,
  options: [
    { id: 10, label: "Ya" },
    { id: 11, label: "Tidak" },
    { id: 12, label: "Lama", archived: true },
  ],
};
const q2 = { id: 2, type: "SCALE", label: "Nilai", required: false, scaleMin: 1, scaleMax: 5, options: [] };
const q3 = { id: 3, type: "SHORT_TEXT", label: "Catatan", required: false, options: [] };

function submit(questions: unknown[]) {
  return surveyFormSchema.parse({ title: "S", questions } as SurveyFormInput);
}

function plan(questions: unknown[], answeredQ: number[] = [], answeredO: number[] = [], from = current) {
  return planFormUpdate(from, submit(questions), new Set(answeredQ), new Set(answeredO));
}

function ops(result: ReturnType<typeof plan>) {
  if (!result.ok) throw new Error(`violations: ${JSON.stringify(result.violations)}`);
  return result.ops;
}

function updateOf(list: ReturnType<typeof ops>, id: number) {
  const found = list.find((o) => o.kind === "update" && o.id === id);
  if (!found || found.kind !== "update") throw new Error(`no update for ${id}`);
  return found;
}

describe("planFormUpdate — unanswered form is free", () => {
  it("plans an update for each unchanged existing question and nothing structural", () => {
    expect(ops(plan([q1, q2, q3])).map((o) => o.kind)).toEqual(["update", "update", "update"]);
  });

  it("allows changing the type of a question that has no answers", () => {
    expect(updateOf(ops(plan([q1, q2, { ...q3, type: "NUMBER" }])), 3)).toMatchObject({ type: "NUMBER" });
  });

  it("deletes questions and options that are removed while unanswered", () => {
    const list = ops(plan([{ ...q1, options: [{ id: 10, label: "Ya" }, { label: "Mungkin" }] }]));
    expect(list.filter((o) => o.kind === "delete")).toEqual([
      { kind: "delete", id: 2 },
      { kind: "delete", id: 3 },
    ]);
    expect(updateOf(list, 1).options.delete).toEqual([11, 12]);
    expect(updateOf(list, 1).options.create).toEqual([{ label: "Mungkin", order: 1, archived: false }]);
  });

  it("uses the array index as order", () => {
    const list = ops(plan([q3, q1, q2]));
    expect(list.map((o) => (o.kind === "update" ? [o.id, o.order] : null))).toEqual([
      [3, 0],
      [1, 1],
      [2, 2],
    ]);
  });
});

describe("planFormUpdate — form locks once answered", () => {
  it("rejects a type change on an answered question", () => {
    const result = plan([{ ...q1, type: "SHORT_TEXT", options: [] }, q2, q3], [1]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0].path).toEqual(["questions", 0, "type"]);
  });

  it("rejects a scale range change on an answered scale question", () => {
    const result = plan([q1, { ...q2, scaleMax: 7 }, q3], [2]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0].path).toEqual(["questions", 1, "scaleMax"]);
  });

  it("allows label, required and order edits on answered questions", () => {
    const list = ops(plan([{ ...q3, label: "Baru", required: true }, q1, q2], [1, 3]));
    expect(updateOf(list, 3)).toMatchObject({ label: "Baru", required: true, order: 0 });
  });

  it("archives an answered question that is removed instead of deleting it", () => {
    const list = ops(plan([q1, q2], [3]));
    expect(list).toContainEqual({ kind: "archive", id: 3 });
    expect(list.some((o) => o.kind === "delete")).toBe(false);
  });

  it("archives an answered option that is removed", () => {
    const list = ops(
      plan(
        [{ ...q1, options: [{ id: 10, label: "Ya" }, { label: "Mungkin" }, { id: 12, label: "Lama", archived: true }] }, q2, q3],
        [1],
        [11],
      ),
    );
    expect(updateOf(list, 1).options.archive).toEqual([11]);
    expect(updateOf(list, 1).options.delete).toEqual([]);
  });

  it("keeps an answered option's id when it is renamed", () => {
    const list = ops(
      plan(
        [{ ...q1, options: [{ id: 10, label: "Iya" }, { id: 11, label: "Tidak" }, { id: 12, label: "Lama", archived: true }] }, q2, q3],
        [1],
        [10],
      ),
    );
    expect(updateOf(list, 1).options.update).toContainEqual(expect.objectContaining({ id: 10, label: "Iya" }));
  });

  it("allows adding a question and an option after answers exist", () => {
    const list = ops(
      plan(
        [{ ...q1, options: [...q1.options, { label: "Mungkin" }] }, q2, q3, { type: "NUMBER", label: "Umur", required: false, options: [] }],
        [1, 2, 3],
        [10, 11],
      ),
    );
    expect(list.find((o) => o.kind === "create")).toMatchObject({ type: "NUMBER", order: 3 });
    expect(updateOf(list, 1).options.create).toEqual([{ label: "Mungkin", order: 3, archived: false }]);
  });

  it("restores an archived question", () => {
    const withArchived: CurrentForm = {
      questions: [current.questions[0], current.questions[1], { ...current.questions[2], archived: true }],
    };
    const list = ops(plan([q1, q2, q3], [3], [], withArchived));
    expect(updateOf(list, 3)).toMatchObject({ archived: false });
  });

  it("does not re-archive a question that is already archived and omitted", () => {
    const withArchived: CurrentForm = {
      questions: [current.questions[0], current.questions[1], { ...current.questions[2], archived: true }],
    };
    expect(ops(plan([q1, q2], [3], [], withArchived)).some((o) => o.kind === "archive")).toBe(false);
  });
});

describe("planFormUpdate — client ids are never trusted", () => {
  it("rejects a question id that is not in the survey", () => {
    expect(plan([q1, q2, q3, { ...q3, id: 99 }]).ok).toBe(false);
  });

  it("rejects an option id that belongs to another question", () => {
    const result = plan([
      { ...q1, options: [{ id: 10, label: "Ya" }, { id: 11, label: "Tidak" }] },
      q2,
      { ...q3, type: "SINGLE_CHOICE", options: [{ id: 10, label: "Ya" }, { label: "Tidak" }] },
    ]);
    expect(result.ok).toBe(false);
  });
});
