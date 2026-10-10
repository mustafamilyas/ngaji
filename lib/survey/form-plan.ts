import type { QuestionType } from "@/lib/validation/enums";
import type { SurveyForm } from "@/lib/validation/survey";

/** The stored form, reduced to what the lock rules need. */
export type CurrentForm = {
  questions: {
    id: number;
    type: QuestionType;
    scaleMin: number | null;
    scaleMax: number | null;
    archived: boolean;
    options: { id: number; archived: boolean }[];
  }[];
};

export type FormViolation = { path: (string | number)[]; message: string };

type QuestionFields = {
  order: number;
  type: QuestionType;
  label: string;
  helpText: string | undefined;
  required: boolean;
  scaleMin: number | undefined;
  scaleMax: number | undefined;
  archived: boolean;
};

type NewOption = { label: string; order: number; archived: boolean };

export type OptionOps = {
  create: NewOption[];
  update: { id: number; label: string; order: number; archived: boolean }[];
  /** Answered options that were removed: kept, hidden from the entry form. */
  archive: number[];
  /** Unanswered options that were removed. */
  delete: number[];
};

export type FormOp =
  | ({ kind: "create"; options: NewOption[] } & QuestionFields)
  | ({ kind: "update"; id: number; options: OptionOps } & QuestionFields)
  | { kind: "archive"; id: number }
  | { kind: "delete"; id: number };

export type FormPlan = { ok: true; ops: FormOp[] } | { ok: false; violations: FormViolation[] };

function questionFields(q: SurveyForm["questions"][number], order: number): QuestionFields {
  return {
    order,
    type: q.type,
    label: q.label,
    helpText: q.helpText,
    required: q.required,
    scaleMin: q.scaleMin,
    scaleMax: q.scaleMax,
    archived: q.archived ?? false,
  };
}

/**
 * Diffs the submitted whole-form payload against the stored form. Pure: the
 * lock is derived from `answeredQuestionIds` / `answeredOptionIds` (ids that
 * have at least one SurveyAnswer), never stored. Returns the operations to
 * apply, or every violation (foreign ids, type/scale change on an answered
 * question) with nothing to write.
 *
 * Removal semantics: an omitted question/option is deleted when it never held
 * data and archived when answered. Array index is the new order.
 */
export function planFormUpdate(
  current: CurrentForm,
  submitted: SurveyForm,
  answeredQuestionIds: ReadonlySet<number>,
  answeredOptionIds: ReadonlySet<number>,
): FormPlan {
  const violations: FormViolation[] = [];
  const ops: FormOp[] = [];
  const currentById = new Map(current.questions.map((q) => [q.id, q]));
  const keptQuestionIds = new Set<number>();

  submitted.questions.forEach((q, qi) => {
    const existing = q.id === undefined ? undefined : currentById.get(q.id);
    if (q.id !== undefined && !existing) {
      violations.push({ path: ["questions", qi, "id"], message: "Pertanyaan tidak ditemukan" });
      return;
    }

    if (!existing) {
      ops.push({
        kind: "create",
        ...questionFields(q, qi),
        options: q.options.map((o, oi) => ({ label: o.label, order: oi, archived: o.archived ?? false })),
      });
      return;
    }

    keptQuestionIds.add(existing.id);

    if (answeredQuestionIds.has(existing.id)) {
      if (q.type !== existing.type) {
        violations.push({
          path: ["questions", qi, "type"],
          message: "Tipe pertanyaan tidak bisa diubah karena sudah ada jawaban",
        });
      }
      if (existing.type === "SCALE" && q.type === "SCALE") {
        if (q.scaleMin !== existing.scaleMin) {
          violations.push({
            path: ["questions", qi, "scaleMin"],
            message: "Rentang skala tidak bisa diubah karena sudah ada jawaban",
          });
        }
        if (q.scaleMax !== existing.scaleMax) {
          violations.push({
            path: ["questions", qi, "scaleMax"],
            message: "Rentang skala tidak bisa diubah karena sudah ada jawaban",
          });
        }
      }
    }

    const optionOps: OptionOps = { create: [], update: [], archive: [], delete: [] };
    const currentOptions = new Map(existing.options.map((o) => [o.id, o]));
    const keptOptionIds = new Set<number>();

    q.options.forEach((o, oi) => {
      if (o.id === undefined) {
        optionOps.create.push({ label: o.label, order: oi, archived: o.archived ?? false });
      } else if (!currentOptions.has(o.id)) {
        violations.push({ path: ["questions", qi, "options", oi, "id"], message: "Pilihan tidak ditemukan" });
      } else {
        keptOptionIds.add(o.id);
        optionOps.update.push({ id: o.id, label: o.label, order: oi, archived: o.archived ?? false });
      }
    });

    for (const option of existing.options) {
      if (keptOptionIds.has(option.id)) continue;
      if (!answeredOptionIds.has(option.id)) optionOps.delete.push(option.id);
      else if (!option.archived) optionOps.archive.push(option.id);
    }

    ops.push({ kind: "update", id: existing.id, ...questionFields(q, qi), options: optionOps });
  });

  for (const existing of current.questions) {
    if (keptQuestionIds.has(existing.id)) continue;
    if (!answeredQuestionIds.has(existing.id)) ops.push({ kind: "delete", id: existing.id });
    else if (!existing.archived) ops.push({ kind: "archive", id: existing.id });
  }

  return violations.length > 0 ? { ok: false, violations } : { ok: true, ops };
}
