import { LONG_TEXT_MAX, SHORT_TEXT_MAX } from "@/lib/constants";
import type { QuestionType } from "@/lib/validation/enums";

export type AnswerQuestion = {
  id: number;
  type: QuestionType;
  required: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  archived: boolean;
  options: { id: number; archived: boolean }[];
};

/** One entry per question: `optionIds` for choices, `number` for NUMBER/SCALE, `text` for text types. */
export type SubmittedAnswer = { questionId: number; optionIds?: number[]; number?: number; text?: string };

export type AnswerRow = { questionId: number; optionId?: number; numberValue?: number; textValue?: string };

export type AnswerError = { questionId: number; message: string };

export type AnswerValidation = { ok: true; rows: AnswerRow[] } | { ok: false; errors: AnswerError[] };

/**
 * Validates submitted answers against the survey's current questions.
 * `questions` must be ALL questions of the survey (archived included);
 * `existing` is the member's stored answers (empty for a first save).
 *
 * `rows` is what the caller inserts after deleting the response's answers for
 * non-archived questions: it never contains rows for archived questions
 * (their stored answers are left untouched), and it carries over existing
 * picks of options archived since the original save, which count toward
 * required / single-choice cardinality. Nothing is returned when any answer is
 * invalid. Fields irrelevant to a question's type are ignored.
 */
export function validateAnswers(
  questions: readonly AnswerQuestion[],
  submitted: readonly SubmittedAnswer[],
  existing: readonly AnswerRow[],
): AnswerValidation {
  const errors: AnswerError[] = [];
  const rows: AnswerRow[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answers = new Map<number, SubmittedAnswer>();

  for (const answer of submitted) {
    const question = byId.get(answer.questionId);
    if (!question || question.archived) {
      errors.push({ questionId: answer.questionId, message: "Pertanyaan tidak valid" });
    } else if (answers.has(answer.questionId)) {
      errors.push({ questionId: answer.questionId, message: "Jawaban ganda" });
    } else {
      answers.set(answer.questionId, answer);
    }
  }

  for (const question of questions) {
    if (question.archived) continue;
    const answer = answers.get(question.id);
    const fail = (message: string) => errors.push({ questionId: question.id, message });
    const missing = () => {
      if (question.required) fail("Wajib diisi");
    };

    switch (question.type) {
      case "SINGLE_CHOICE":
      case "MULTI_CHOICE": {
        const optionById = new Map(question.options.map((o) => [o.id, o]));
        const picked = answer?.optionIds ?? [];
        if (new Set(picked).size !== picked.length) {
          fail("Pilihan ganda");
          break;
        }
        if (picked.some((id) => !optionById.get(id) || optionById.get(id)?.archived)) {
          fail("Pilihan tidak valid");
          break;
        }
        const carried = existing.filter(
          (row) =>
            row.questionId === question.id && row.optionId !== undefined && optionById.get(row.optionId)?.archived,
        );
        const total = picked.length + carried.length;
        if (total === 0) {
          missing();
        } else if (question.type === "SINGLE_CHOICE" && total !== 1) {
          fail("Pilih satu");
        } else {
          for (const optionId of picked) rows.push({ questionId: question.id, optionId });
          for (const row of carried) rows.push({ questionId: question.id, optionId: row.optionId });
        }
        break;
      }
      case "NUMBER":
      case "SCALE": {
        const value = answer?.number;
        if (value === undefined) {
          missing();
        } else if (!Number.isFinite(value)) {
          fail("Angka tidak valid");
        } else if (
          question.type === "SCALE" &&
          (!Number.isInteger(value) || value < (question.scaleMin ?? 1) || value > (question.scaleMax ?? 5))
        ) {
          fail("Nilai di luar skala");
        } else {
          rows.push({ questionId: question.id, numberValue: value });
        }
        break;
      }
      case "SHORT_TEXT":
      case "LONG_TEXT": {
        const text = answer?.text?.trim() ?? "";
        const max = question.type === "SHORT_TEXT" ? SHORT_TEXT_MAX : LONG_TEXT_MAX;
        if (!text) {
          missing();
        } else if (text.length > max) {
          fail(`Maksimal ${max} karakter`);
        } else {
          rows.push({ questionId: question.id, textValue: text });
        }
        break;
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows };
}
