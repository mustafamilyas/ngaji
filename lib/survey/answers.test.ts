import { describe, expect, it } from "vitest";
import { LONG_TEXT_MAX, SHORT_TEXT_MAX } from "@/lib/constants";
import { validateAnswers, type AnswerQuestion } from "./answers";

const questions: AnswerQuestion[] = [
  {
    id: 1,
    type: "SINGLE_CHOICE",
    required: true,
    scaleMin: null,
    scaleMax: null,
    archived: false,
    options: [
      { id: 10, archived: false },
      { id: 11, archived: false },
      { id: 12, archived: true },
    ],
  },
  {
    id: 2,
    type: "MULTI_CHOICE",
    required: false,
    scaleMin: null,
    scaleMax: null,
    archived: false,
    options: [
      { id: 20, archived: false },
      { id: 21, archived: false },
      { id: 22, archived: true },
    ],
  },
  { id: 3, type: "NUMBER", required: false, scaleMin: null, scaleMax: null, archived: false, options: [] },
  { id: 4, type: "SCALE", required: false, scaleMin: 1, scaleMax: 5, archived: false, options: [] },
  { id: 5, type: "SHORT_TEXT", required: false, scaleMin: null, scaleMax: null, archived: false, options: [] },
  { id: 6, type: "LONG_TEXT", required: false, scaleMin: null, scaleMax: null, archived: false, options: [] },
  { id: 7, type: "SHORT_TEXT", required: false, scaleMin: null, scaleMax: null, archived: true, options: [] },
];

const ok = [{ questionId: 1, optionIds: [10] }];

function run(submitted: Parameters<typeof validateAnswers>[1], existing: Parameters<typeof validateAnswers>[2] = []) {
  return validateAnswers(questions, submitted, existing);
}

function errorFor(result: ReturnType<typeof run>, questionId: number) {
  if (result.ok) throw new Error("expected errors");
  return result.errors.find((e) => e.questionId === questionId)?.message;
}

describe("validateAnswers — ids", () => {
  it("accepts a valid minimal response and returns one row per selected option", () => {
    const result = run([...ok, { questionId: 2, optionIds: [20, 21] }]);
    expect(result).toEqual({
      ok: true,
      rows: [
        { questionId: 1, optionId: 10 },
        { questionId: 2, optionId: 20 },
        { questionId: 2, optionId: 21 },
      ],
    });
  });

  it("rejects a question that is not in the survey", () => {
    expect(errorFor(run([...ok, { questionId: 99, text: "x" }]), 99)).toBeDefined();
  });

  it("rejects an answer to an archived question", () => {
    expect(errorFor(run([...ok, { questionId: 7, text: "x" }]), 7)).toBeDefined();
  });

  it("rejects an option from another question or survey", () => {
    expect(errorFor(run([{ questionId: 1, optionIds: [20] }]), 1)).toBeDefined();
    expect(errorFor(run([{ questionId: 1, optionIds: [999] }]), 1)).toBeDefined();
  });

  it("rejects a newly chosen archived option", () => {
    expect(errorFor(run([{ questionId: 1, optionIds: [12] }]), 1)).toBeDefined();
  });

  it("rejects two answers for the same question", () => {
    expect(errorFor(run([...ok, { questionId: 3, number: 1 }, { questionId: 3, number: 2 }]), 3)).toBeDefined();
  });
});

describe("validateAnswers — per-type rules", () => {
  it("single choice needs exactly one option", () => {
    expect(errorFor(run([{ questionId: 1, optionIds: [10, 11] }]), 1)).toBeDefined();
  });

  it("multi choice rejects duplicate option ids", () => {
    expect(errorFor(run([...ok, { questionId: 2, optionIds: [20, 20] }]), 2)).toBeDefined();
  });

  it("number must be finite", () => {
    expect(errorFor(run([...ok, { questionId: 3, number: Number.NaN }]), 3)).toBeDefined();
    expect(errorFor(run([...ok, { questionId: 3, number: Infinity }]), 3)).toBeDefined();
    expect(run([...ok, { questionId: 3, number: -2.5 }]).ok).toBe(true);
  });

  it("scale must be an integer within range", () => {
    expect(errorFor(run([...ok, { questionId: 4, number: 7 }]), 4)).toBeDefined();
    expect(errorFor(run([...ok, { questionId: 4, number: 0 }]), 4)).toBeDefined();
    expect(errorFor(run([...ok, { questionId: 4, number: 2.5 }]), 4)).toBeDefined();
    expect(run([...ok, { questionId: 4, number: 5 }]).ok).toBe(true);
  });

  it("text is trimmed and stored", () => {
    const result = run([...ok, { questionId: 5, text: "  halo  " }]);
    expect(result.ok && result.rows).toContainEqual({ questionId: 5, textValue: "halo" });
  });

  it("rejects text over the limit instead of truncating", () => {
    expect(errorFor(run([...ok, { questionId: 5, text: "a".repeat(SHORT_TEXT_MAX + 1) }]), 5)).toBeDefined();
    expect(errorFor(run([...ok, { questionId: 6, text: "a".repeat(LONG_TEXT_MAX + 1) }]), 6)).toBeDefined();
    expect(run([...ok, { questionId: 6, text: "a".repeat(LONG_TEXT_MAX) }]).ok).toBe(true);
  });
});

describe("validateAnswers — required and optional", () => {
  it("rejects a missing required answer", () => {
    expect(errorFor(run([]), 1)).toBeDefined();
    expect(errorFor(run([{ questionId: 1, optionIds: [] }]), 1)).toBeDefined();
  });

  it("stores no row for an optional question left empty", () => {
    const result = run([...ok, { questionId: 5, text: "   " }, { questionId: 2, optionIds: [] }]);
    expect(result).toEqual({ ok: true, rows: [{ questionId: 1, optionId: 10 }] });
  });

  it("reports every invalid question and writes nothing", () => {
    const result = run([{ questionId: 4, number: 9 }, { questionId: 5, text: "a".repeat(SHORT_TEXT_MAX + 1) }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.questionId).sort()).toEqual([1, 4, 5]);
  });
});

describe("validateAnswers — archived options on existing responses", () => {
  const existing = [
    { questionId: 1, optionId: 12 },
    { questionId: 2, optionId: 22 },
    { questionId: 7, textValue: "lama" },
  ];

  it("keeps an archived single-choice pick, which satisfies required", () => {
    const result = run([], existing);
    expect(result.ok && result.rows).toContainEqual({ questionId: 1, optionId: 12 });
  });

  it("rejects adding a second option next to a kept archived single-choice pick", () => {
    expect(errorFor(run([{ questionId: 1, optionIds: [10] }], existing), 1)).toBeDefined();
  });

  it("keeps an archived multi-choice pick alongside newly chosen options", () => {
    const result = run([...ok, { questionId: 2, optionIds: [20] }], [existing[1]]);
    expect(result).toEqual({
      ok: true,
      rows: [
        { questionId: 1, optionId: 10 },
        { questionId: 2, optionId: 20 },
        { questionId: 2, optionId: 22 },
      ],
    });
  });

  it("never returns rows for archived questions, so their stored answers stay untouched", () => {
    const result = run(ok, existing);
    expect(result.ok && result.rows.some((r) => r.questionId === 7)).toBe(false);
  });
});
