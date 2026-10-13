import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { SCALE_DEFAULT_MAX, SCALE_DEFAULT_MIN } from "@/lib/constants";
import { QUESTION_TYPES, type QuestionType } from "@/lib/validation/enums";
import type { SurveyForm, SurveyFormInput } from "@/lib/validation/survey";

export const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Pilihan tunggal",
  MULTI_CHOICE: "Pilihan ganda",
  NUMBER: "Angka",
  SCALE: "Skala",
  SHORT_TEXT: "Teks pendek",
  LONG_TEXT: "Teks panjang",
};

export const TYPE_ITEMS = QUESTION_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

export type QuestionValue = SurveyFormInput["questions"][number];
export type SurveyFormMethods = UseFormReturn<SurveyFormInput, unknown, SurveyForm>;
export type FormErrors = SurveyFormMethods["formState"]["errors"];

export function isChoice(type: QuestionType) {
  return type === "SINGLE_CHOICE" || type === "MULTI_CHOICE";
}

/** Form ids are typed `unknown` (the schema coerces them), so narrow before the lookup. */
export function isLocked(ids: ReadonlySet<number>, id: unknown): boolean {
  return typeof id === "number" && ids.has(id);
}

export function blankQuestion(type: QuestionType): QuestionValue {
  return {
    type,
    label: "",
    required: false,
    options: isChoice(type) ? [{ label: "" }, { label: "" }] : [],
    ...(type === "SCALE" ? { scaleMin: SCALE_DEFAULT_MIN, scaleMax: SCALE_DEFAULT_MAX } : {}),
  };
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
    </label>
  );
}

export function LockHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
