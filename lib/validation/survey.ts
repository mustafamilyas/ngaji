import { z } from "zod";
import {
  SCALE_DEFAULT_MAX,
  SCALE_DEFAULT_MIN,
  SCALE_MAX_STEPS,
  SURVEY_DESCRIPTION_MAX,
  SURVEY_HELP_TEXT_MAX,
  SURVEY_MAX_OPTIONS,
  SURVEY_MAX_QUESTIONS,
  SURVEY_OPTION_LABEL_MAX,
  SURVEY_QUESTION_LABEL_MAX,
  SURVEY_TITLE_MAX,
} from "@/lib/constants";
import { idSchema } from "./common";
import { QUESTION_TYPES } from "./enums";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value ? value : undefined))
    .optional();

const optionSchema = z.object({
  /** Present = an existing option of this survey (server verifies); absent = new. */
  id: idSchema.optional(),
  label: z.string().trim().min(1, "Pilihan wajib diisi").max(SURVEY_OPTION_LABEL_MAX),
  archived: z.boolean().optional(),
});

const questionSchema = z.object({
  /** Present = an existing question of this survey (server verifies); absent = new. */
  id: idSchema.optional(),
  type: z.enum(QUESTION_TYPES),
  label: z.string().trim().min(1, "Pertanyaan wajib diisi").max(SURVEY_QUESTION_LABEL_MAX),
  helpText: optionalText(SURVEY_HELP_TEXT_MAX),
  required: z.boolean(),
  scaleMin: z.number().int().optional(),
  scaleMax: z.number().int().optional(),
  archived: z.boolean().optional(),
  options: z.array(optionSchema).max(SURVEY_MAX_OPTIONS),
});

function hasDuplicates(values: (number | undefined)[]): boolean {
  const ids = values.filter((value): value is number => value !== undefined);
  return new Set(ids).size !== ids.length;
}

/**
 * Whole-form payload for create/update, shared by the builder and the Server
 * Action. Array order is the question/option order. Lock-once-answered rules
 * depend on stored data and live in `planFormUpdate`, not here.
 */
export const surveyFormSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi").max(SURVEY_TITLE_MAX),
    description: optionalText(SURVEY_DESCRIPTION_MAX),
    questions: z.array(questionSchema).max(SURVEY_MAX_QUESTIONS),
  })
  .transform((form) => ({
    ...form,
    questions: form.questions.map((q) =>
      q.type === "SCALE"
        ? { ...q, scaleMin: q.scaleMin ?? SCALE_DEFAULT_MIN, scaleMax: q.scaleMax ?? SCALE_DEFAULT_MAX }
        : { ...q, scaleMin: undefined, scaleMax: undefined },
    ),
  }))
  .superRefine((form, ctx) => {
    if (!form.questions.some((q) => !q.archived)) {
      ctx.addIssue({ code: "custom", path: ["questions"], message: "Tambahkan minimal satu pertanyaan" });
    }
    if (hasDuplicates(form.questions.map((q) => q.id))) {
      ctx.addIssue({ code: "custom", path: ["questions"], message: "Pertanyaan duplikat" });
    }

    form.questions.forEach((q, qi) => {
      const isChoice = q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE";

      if (!isChoice) {
        if (q.options.length > 0) {
          ctx.addIssue({ code: "custom", path: ["questions", qi, "options"], message: "Tipe ini tidak memiliki pilihan" });
        }
      } else {
        const active = q.options.filter((o) => !o.archived);
        if (active.length < 2) {
          ctx.addIssue({ code: "custom", path: ["questions", qi, "options"], message: "Minimal dua pilihan" });
        }
        const labels = active.map((o) => o.label.toLowerCase());
        if (new Set(labels).size !== labels.length) {
          ctx.addIssue({ code: "custom", path: ["questions", qi, "options"], message: "Pilihan tidak boleh sama" });
        }
        if (hasDuplicates(q.options.map((o) => o.id))) {
          ctx.addIssue({ code: "custom", path: ["questions", qi, "options"], message: "Pilihan duplikat" });
        }
      }

      if (q.type === "SCALE" && q.scaleMin !== undefined && q.scaleMax !== undefined) {
        if (q.scaleMin >= q.scaleMax) {
          ctx.addIssue({ code: "custom", path: ["questions", qi, "scaleMax"], message: "Batas atas harus lebih besar dari batas bawah" });
        } else if (q.scaleMax - q.scaleMin + 1 > SCALE_MAX_STEPS) {
          ctx.addIssue({ code: "custom", path: ["questions", qi, "scaleMax"], message: `Skala maksimal ${SCALE_MAX_STEPS} langkah` });
        }
      }
    });
  });

export type SurveyFormInput = z.input<typeof surveyFormSchema>;
export type SurveyForm = z.output<typeof surveyFormSchema>;
export type SurveyQuestionInput = SurveyForm["questions"][number];

/** "Ya/Tidak" preset: a SINGLE_CHOICE question with options Ya and Tidak. */
export function yesNoQuestion(label: string): SurveyFormInput["questions"][number] {
  return {
    type: "SINGLE_CHOICE",
    label,
    required: false,
    options: [{ label: "Ya" }, { label: "Tidak" }],
  };
}
