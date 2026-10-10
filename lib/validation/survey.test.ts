import { describe, expect, it } from "vitest";
import { SURVEY_TITLE_MAX } from "@/lib/constants";
import { surveyFormSchema, yesNoQuestion } from "./survey";

function question(overrides: Record<string, unknown> = {}) {
  return { type: "SHORT_TEXT", label: "Nama panggilan", required: false, options: [], ...overrides };
}

function form(overrides: Record<string, unknown> = {}) {
  return { title: "Survei Ramadhan", questions: [question()], ...overrides };
}

function choice(labels: string[], overrides: Record<string, unknown> = {}) {
  return question({
    type: "SINGLE_CHOICE",
    label: "Pilihan",
    options: labels.map((label) => ({ label })),
    ...overrides,
  });
}

describe("surveyFormSchema — survey fields", () => {
  it("accepts a minimal valid form", () => {
    expect(surveyFormSchema.safeParse(form()).success).toBe(true);
  });

  it("rejects a blank title", () => {
    const result = surveyFormSchema.safeParse(form({ title: "   " }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["title"]);
  });

  it("trims the title", () => {
    const result = surveyFormSchema.parse(form({ title: "  Judul  " }));
    expect(result.title).toBe("Judul");
  });

  it("rejects a title over the max length instead of truncating", () => {
    expect(surveyFormSchema.safeParse(form({ title: "a".repeat(SURVEY_TITLE_MAX + 1) })).success).toBe(false);
  });

  it("treats a blank description as absent", () => {
    expect(surveyFormSchema.parse(form({ description: "  " })).description).toBeUndefined();
  });

  it("rejects a form without any active question", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [] })).success).toBe(false);
    expect(surveyFormSchema.safeParse(form({ questions: [question({ id: 1, archived: true })] })).success).toBe(false);
  });
});

describe("surveyFormSchema — choice questions", () => {
  it("rejects a choice question with one option", () => {
    const result = surveyFormSchema.safeParse(form({ questions: [choice(["Ya"])] }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["questions", 0, "options"]);
  });

  it("accepts two options for single and multi choice", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [choice(["A", "B"])] })).success).toBe(true);
    expect(
      surveyFormSchema.safeParse(form({ questions: [choice(["A", "B"], { type: "MULTI_CHOICE" })] })).success,
    ).toBe(true);
  });

  it("rejects an empty option label", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [choice(["A", "  "])] })).success).toBe(false);
  });

  it("rejects duplicate option labels, ignoring case and surrounding spaces", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [choice(["Ya", " ya "])] })).success).toBe(false);
  });

  it("counts only non-archived options toward the minimum", () => {
    const options = [{ label: "A" }, { label: "B", id: 2, archived: true }];
    expect(
      surveyFormSchema.safeParse(form({ questions: [question({ type: "SINGLE_CHOICE", options })] })).success,
    ).toBe(false);
  });

  it("allows an archived option to share a label with an active one", () => {
    const options = [{ label: "A" }, { label: "B" }, { label: "A", id: 9, archived: true }];
    expect(
      surveyFormSchema.safeParse(form({ questions: [question({ type: "SINGLE_CHOICE", options })] })).success,
    ).toBe(true);
  });

  it("rejects options on a non-choice question", () => {
    const result = surveyFormSchema.safeParse(form({ questions: [question({ options: [{ label: "A" }] })] }));
    expect(result.success).toBe(false);
  });
});

describe("surveyFormSchema — scale questions", () => {
  const scale = (overrides: Record<string, unknown> = {}) =>
    form({ questions: [question({ type: "SCALE", label: "Skala", ...overrides })] });

  it("defaults the range to 1–5", () => {
    const parsed = surveyFormSchema.parse(scale());
    expect(parsed.questions[0].scaleMin).toBe(1);
    expect(parsed.questions[0].scaleMax).toBe(5);
  });

  it("rejects scaleMin >= scaleMax", () => {
    expect(surveyFormSchema.safeParse(scale({ scaleMin: 5, scaleMax: 1 })).success).toBe(false);
    expect(surveyFormSchema.safeParse(scale({ scaleMin: 3, scaleMax: 3 })).success).toBe(false);
  });

  it("allows at most 11 steps", () => {
    expect(surveyFormSchema.safeParse(scale({ scaleMin: 0, scaleMax: 10 })).success).toBe(true);
    expect(surveyFormSchema.safeParse(scale({ scaleMin: 0, scaleMax: 11 })).success).toBe(false);
  });

  it("rejects non-integer bounds", () => {
    expect(surveyFormSchema.safeParse(scale({ scaleMin: 1, scaleMax: 4.5 })).success).toBe(false);
  });

  it("drops scale bounds on non-scale questions", () => {
    const parsed = surveyFormSchema.parse(form({ questions: [question({ scaleMin: 1, scaleMax: 5 })] }));
    expect(parsed.questions[0].scaleMin).toBeUndefined();
    expect(parsed.questions[0].scaleMax).toBeUndefined();
  });
});

describe("surveyFormSchema — questions", () => {
  it("rejects an unknown question type", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [question({ type: "DATE" })] })).success).toBe(false);
  });

  it("rejects a blank question label", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [question({ label: " " })] })).success).toBe(false);
  });

  it("rejects non-positive ids from the client", () => {
    expect(surveyFormSchema.safeParse(form({ questions: [question({ id: 0 })] })).success).toBe(false);
  });

  it("rejects duplicate question or option ids in one payload", () => {
    const dupQuestions = form({ questions: [question({ id: 1 }), question({ id: 1 })] });
    expect(surveyFormSchema.safeParse(dupQuestions).success).toBe(false);
    const dupOptions = form({
      questions: [question({ type: "SINGLE_CHOICE", options: [{ id: 5, label: "A" }, { id: 5, label: "B" }] })],
    });
    expect(surveyFormSchema.safeParse(dupOptions).success).toBe(false);
  });
});

describe("yesNoQuestion", () => {
  it("builds a SINGLE_CHOICE question with options Ya and Tidak", () => {
    const q = yesNoQuestion("Hadir di acara?");
    expect(q.type).toBe("SINGLE_CHOICE");
    expect(q.label).toBe("Hadir di acara?");
    expect(q.options.map((o) => o.label)).toEqual(["Ya", "Tidak"]);
    expect(surveyFormSchema.safeParse(form({ questions: [q] })).success).toBe(true);
  });
});
