"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { type Control, Controller, type UseFormRegister, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Save, ToggleLeft, Trash2, X } from "lucide-react";
import { createSurveyAction } from "@/app/survei/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SCALE_DEFAULT_MAX, SCALE_DEFAULT_MIN, SURVEY_MAX_QUESTIONS } from "@/lib/constants";
import { QUESTION_TYPES, type QuestionType } from "@/lib/validation/enums";
import { type SurveyForm, type SurveyFormInput, surveyFormSchema, yesNoQuestion } from "@/lib/validation/survey";

const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Pilihan tunggal",
  MULTI_CHOICE: "Pilihan ganda",
  NUMBER: "Angka",
  SCALE: "Skala",
  SHORT_TEXT: "Teks pendek",
  LONG_TEXT: "Teks panjang",
};

const TYPE_ITEMS = QUESTION_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

function isChoice(type: QuestionType) {
  return type === "SINGLE_CHOICE" || type === "MULTI_CHOICE";
}

type QuestionValue = SurveyFormInput["questions"][number];

function blankQuestion(type: QuestionType): QuestionValue {
  return {
    type,
    label: "",
    required: false,
    options: isChoice(type) ? [{ label: "" }, { label: "" }] : [],
    ...(type === "SCALE" ? { scaleMin: SCALE_DEFAULT_MIN, scaleMax: SCALE_DEFAULT_MAX } : {}),
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
    </label>
  );
}

type FormErrors = ReturnType<typeof useForm<SurveyFormInput, unknown, SurveyForm>>["formState"]["errors"];

function OptionList({
  index,
  control,
  register,
  errors,
}: {
  index: number;
  control: Control<SurveyFormInput, unknown, SurveyForm>;
  register: UseFormRegister<SurveyFormInput>;
  errors: FormErrors;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `questions.${index}.options` });
  const optionsError = errors.questions?.[index]?.options;
  const listError = optionsError?.root?.message ?? optionsError?.message;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pilihan</span>
      {fields.map((field, oi) => (
        <div key={field.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Pilihan ${oi + 1}`}
              placeholder={`Pilihan ${oi + 1}`}
              {...register(`questions.${index}.options.${oi}.label`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Hapus pilihan ${oi + 1}`}
              onClick={() => remove(oi)}
            >
              <X />
            </Button>
          </div>
          <FieldError message={optionsError?.[oi]?.label?.message} />
        </div>
      ))}
      <FieldError message={listError} />
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => append({ label: "" })}>
        <Plus />
        Tambah pilihan
      </Button>
    </div>
  );
}

function QuestionCard({
  index,
  total,
  control,
  register,
  errors,
  onMove,
  onRemove,
  onTypeChange,
}: {
  index: number;
  total: number;
  control: Control<SurveyFormInput, unknown, SurveyForm>;
  register: UseFormRegister<SurveyFormInput>;
  errors: FormErrors;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onTypeChange: (index: number, type: QuestionType) => void;
}) {
  const type = useWatch({ control, name: `questions.${index}.type` });
  const questionErrors = errors.questions?.[index];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Pertanyaan {index + 1}</h3>
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Naikkan pertanyaan ${index + 1}`}
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Turunkan pertanyaan ${index + 1}`}
              disabled={index === total - 1}
              onClick={() => onMove(index, index + 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Hapus pertanyaan ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`q-${index}-type`}>Jenis</Label>
          <Controller
            control={control}
            name={`questions.${index}.type`}
            render={({ field }) => (
              <Select
                items={TYPE_ITEMS}
                value={field.value}
                onValueChange={(value) => onTypeChange(index, value as QuestionType)}
              >
                <SelectTrigger id={`q-${index}-type`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`q-${index}-label`}>Pertanyaan</Label>
          <Input id={`q-${index}-label`} {...register(`questions.${index}.label`)} />
          <FieldError message={questionErrors?.label?.message} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`q-${index}-help`}>Keterangan (opsional)</Label>
          <Input id={`q-${index}-help`} {...register(`questions.${index}.helpText`)} />
          <FieldError message={questionErrors?.helpText?.message} />
        </div>

        {isChoice(type) && <OptionList index={index} control={control} register={register} errors={errors} />}

        {type === "SCALE" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`q-${index}-min`}>Skala dari</Label>
              <Input
                id={`q-${index}-min`}
                type="number"
                {...register(`questions.${index}.scaleMin`, { valueAsNumber: true })}
              />
              <FieldError message={questionErrors?.scaleMin?.message} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`q-${index}-max`}>Sampai</Label>
              <Input
                id={`q-${index}-max`}
                type="number"
                {...register(`questions.${index}.scaleMax`, { valueAsNumber: true })}
              />
              <FieldError message={questionErrors?.scaleMax?.message} />
            </div>
          </div>
        )}

        <Controller
          control={control}
          name={`questions.${index}.required`}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              Wajib diisi
            </label>
          )}
        />
      </CardContent>
    </Card>
  );
}

export function SurveyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<SurveyFormInput, unknown, SurveyForm>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: { title: "", description: "", questions: [blankQuestion("SHORT_TEXT")] },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: "questions" });

  function changeType(index: number, type: QuestionType) {
    const current = getValues(`questions.${index}`);
    setValue(`questions.${index}`, {
      ...blankQuestion(type),
      label: current.label,
      helpText: current.helpText,
      required: current.required,
    });
  }

  function onSubmit(values: SurveyForm) {
    startTransition(async () => {
      const result = await createSurveyAction(values);
      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/survei/${result.data.id}`);
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
            <Input id="title" {...register("title")} />
            <FieldError message={errors.title?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" {...register("description")} />
            <FieldError message={errors.description?.message} />
          </div>
        </CardContent>
      </Card>

      {fields.map((field, index) => (
        <QuestionCard
          key={field.id}
          index={index}
          total={fields.length}
          control={control}
          register={register}
          errors={errors}
          onMove={move}
          onRemove={remove}
          onTypeChange={changeType}
        />
      ))}

      <FieldError message={questionsError} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={atLimit} onClick={() => append(blankQuestion("SHORT_TEXT"))}>
          <Plus />
          Tambah pertanyaan
        </Button>
        <Button type="button" variant="outline" disabled={atLimit} onClick={() => append(yesNoQuestion(""))}>
          <ToggleLeft />
          Tambah Ya/Tidak
        </Button>
      </div>

      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          <Save />
          {pending ? "Menyimpan…" : "Simpan survei"}
        </Button>
      </div>
    </form>
  );
}
