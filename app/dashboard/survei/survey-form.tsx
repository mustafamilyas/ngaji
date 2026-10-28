"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Save, ToggleLeft } from "lucide-react";
import { createSurveyAction, updateSurveyAction } from "@/app/dashboard/survei/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { SURVEY_MAX_QUESTIONS } from "@/lib/constants";
import type { QuestionType } from "@/lib/validation/enums";
import { type SurveyForm as SurveyFormValues, type SurveyFormInput, surveyFormSchema, yesNoQuestion } from "@/lib/validation/survey";
import { blankQuestion, FieldError, isLocked, Label } from "./form-shared";
import { type FormLocks, QuestionCard } from "./question-card";

const NEW_SURVEY: SurveyFormInput = { title: "", description: "", questions: [blankQuestion("SHORT_TEXT")] };

type Props = {
  /** Present = edit this stored survey; absent = create. */
  surveyId?: number;
  /** Stored form (ids + archived flags) when editing. */
  defaultValues?: SurveyFormInput;
  lockedQuestionIds?: number[];
  lockedOptionIds?: number[];
  /** Everything disabled and no save button — viewers who may not edit the survey. */
  readOnly?: boolean;
};

export function SurveyForm({
  surveyId,
  defaultValues = NEW_SURVEY,
  lockedQuestionIds = [],
  lockedOptionIds = [],
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const form = useForm<SurveyFormInput, unknown, SurveyFormValues>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues,
  });
  const { register, handleSubmit, control, setValue, getValues, setError, reset, formState } = form;
  const { errors } = formState;
  const { fields, append, remove, move } = useFieldArray({ control, name: "questions" });

  // After a save the page re-renders with the stored form; reload it so new
  // questions/options carry their ids and a second save updates, not duplicates.
  const signature = JSON.stringify(defaultValues);
  useEffect(() => {
    reset(JSON.parse(signature) as SurveyFormInput);
  }, [signature, reset]);

  const locks = useMemo<FormLocks>(
    () => ({ questions: new Set(lockedQuestionIds), options: new Set(lockedOptionIds) }),
    [lockedQuestionIds, lockedOptionIds],
  );

  function changeType(index: number, type: QuestionType) {
    const current = getValues(`questions.${index}`);
    setValue(`questions.${index}`, {
      ...blankQuestion(type),
      id: current.id,
      label: current.label,
      helpText: current.helpText,
      required: current.required,
    });
  }

  function removeQuestion(index: number) {
    // An answered question can only be archived; an unanswered one never held data.
    if (isLocked(locks.questions, getValues(`questions.${index}.id`))) {
      setValue(`questions.${index}.archived`, true, { shouldDirty: true });
    } else {
      remove(index);
    }
  }

  function restoreQuestion(index: number) {
    setValue(`questions.${index}.archived`, false, { shouldDirty: true });
  }

  function onSubmit(values: SurveyFormValues) {
    setSaved(false);
    startTransition(async () => {
      const result = surveyId === undefined ? await createSurveyAction(values) : await updateSurveyAction(surveyId, values);
      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      if (surveyId === undefined) {
        router.push(`/dashboard/survei/${result.data.id}`);
      } else {
        setSaved(true);
      }
      router.refresh();
    });
  }

  const questionsError = errors.questions?.root?.message ?? errors.questions?.message;
  const atLimit = fields.length >= SURVEY_MAX_QUESTIONS;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" readOnly={readOnly} {...register("title")} />
            <FieldError message={errors.title?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" className="text-base md:text-base xl:text-sm" readOnly={readOnly} {...register("description")} />
            <FieldError message={errors.description?.message} />
          </div>
        </CardContent>
      </Card>

      {fields.map((field, index) => (
        <QuestionCard
          key={field.id}
          index={index}
          total={fields.length}
          form={form}
          locks={locks}
          readOnly={readOnly}
          onMove={move}
          onRemove={removeQuestion}
          onRestore={restoreQuestion}
          onTypeChange={changeType}
        />
      ))}

      <FieldError message={questionsError} />

      {!readOnly && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={atLimit}
              onClick={() => append(blankQuestion("SHORT_TEXT"))}
            >
              <Plus />
              Tambah pertanyaan
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={atLimit}
              onClick={() => append(yesNoQuestion(""))}
            >
              <ToggleLeft />
              Tambah Ya/Tidak
            </Button>
          </div>

          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-muted-foreground">
              Perubahan tersimpan.
            </p>
          )}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base sm:w-auto xl:h-9 xl:text-sm">
              <Save />
              {pending ? "Menyimpan…" : surveyId === undefined ? "Simpan survei" : "Simpan perubahan"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
