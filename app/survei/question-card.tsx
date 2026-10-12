"use client";

import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Archive, ArrowDown, ArrowUp, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuestionType } from "@/lib/validation/enums";
import {
  FieldError,
  isChoice,
  isLocked,
  Label,
  LockHint,
  type SurveyFormMethods,
  TYPE_ITEMS,
} from "./form-shared";

/** Which stored questions/options already have answers — see `lib/survey/locks.ts`. */
export type FormLocks = { questions: ReadonlySet<number>; options: ReadonlySet<number> };

function OptionList({
  index,
  form,
  locks,
  readOnly,
}: {
  index: number;
  form: SurveyFormMethods;
  locks: FormLocks;
  readOnly: boolean;
}) {
  const { control, register, setValue, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: `questions.${index}.options` });
  const options = useWatch({ control, name: `questions.${index}.options` });
  const optionsError = formState.errors.questions?.[index]?.options;
  const listError = optionsError?.root?.message ?? optionsError?.message;

  function removeOption(oi: number) {
    // An answered option can only be archived; an unanswered one never held data.
    if (isLocked(locks.options, options?.[oi]?.id)) {
      setValue(`questions.${index}.options.${oi}.archived`, true, { shouldDirty: true });
    } else {
      remove(oi);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pilihan</span>
      {fields.map((field, oi) => {
        const locked = isLocked(locks.options, options?.[oi]?.id);
        const archived = options?.[oi]?.archived === true;

        if (archived) {
          return (
            <div key={field.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
                {options?.[oi]?.label}
              </span>
              <Badge variant="outline">Diarsipkan</Badge>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Pulihkan pilihan ${oi + 1}`}
                  onClick={() => setValue(`questions.${index}.options.${oi}.archived`, false, { shouldDirty: true })}
                >
                  <RotateCcw />
                  Pulihkan
                </Button>
              )}
            </div>
          );
        }

        return (
          <div key={field.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Pilihan ${oi + 1}`}
                placeholder={`Pilihan ${oi + 1}`}
                readOnly={readOnly}
                {...register(`questions.${index}.options.${oi}.label`)}
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={locked ? `Arsipkan pilihan ${oi + 1}` : `Hapus pilihan ${oi + 1}`}
                  onClick={() => removeOption(oi)}
                >
                  {locked ? <Archive /> : <X />}
                </Button>
              )}
            </div>
            {locked && (
              <LockHint>Sudah ada jawaban: hanya bisa diarsipkan. Mengubah label juga mengubah jawaban lama.</LockHint>
            )}
            <FieldError message={optionsError?.[oi]?.label?.message} />
          </div>
        );
      })}
      <FieldError message={listError} />
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => append({ label: "" })}>
          <Plus />
          Tambah pilihan
        </Button>
      )}
    </div>
  );
}

export function QuestionCard({
  index,
  total,
  form,
  locks,
  readOnly,
  onMove,
  onRemove,
  onRestore,
  onTypeChange,
}: {
  index: number;
  total: number;
  form: SurveyFormMethods;
  locks: FormLocks;
  readOnly: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onRestore: (index: number) => void;
  onTypeChange: (index: number, type: QuestionType) => void;
}) {
  const { control, register, formState } = form;
  const question = useWatch({ control, name: `questions.${index}` });
  const questionErrors = formState.errors.questions?.[index];
  const locked = isLocked(locks.questions, question.id);

  if (question.archived) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
            {index + 1}. {question.label}
          </h3>
          <Badge variant="outline">Diarsipkan</Badge>
          {!readOnly && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onRestore(index)}>
              <RotateCcw />
              Pulihkan
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Pertanyaan {index + 1}</h3>
          {!readOnly && (
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
                aria-label={locked ? `Arsipkan pertanyaan ${index + 1}` : `Hapus pertanyaan ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                {locked ? <Archive /> : <Trash2 />}
              </Button>
            </div>
          )}
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
                disabled={locked || readOnly}
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
          {locked && (
            <LockHint>
              Sudah ada jawaban: jenis{question.type === "SCALE" ? " dan rentang skala" : ""} tidak bisa diubah, dan
              pertanyaan hanya bisa diarsipkan.
            </LockHint>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`q-${index}-label`}>Pertanyaan</Label>
          <Input id={`q-${index}-label`} readOnly={readOnly} {...register(`questions.${index}.label`)} />
          <FieldError message={questionErrors?.label?.message} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`q-${index}-help`}>Keterangan (opsional)</Label>
          <Input id={`q-${index}-help`} readOnly={readOnly} {...register(`questions.${index}.helpText`)} />
          <FieldError message={questionErrors?.helpText?.message} />
        </div>

        {isChoice(question.type) && <OptionList index={index} form={form} locks={locks} readOnly={readOnly} />}

        {question.type === "SCALE" && (
          <div className="grid grid-cols-2 gap-3">
            {/* readOnly, not disabled: react-hook-form drops the value of disabled inputs, which would reset a locked range. */}
            <div className="flex flex-col gap-1">
              <Label htmlFor={`q-${index}-min`}>Skala dari</Label>
              <Input
                id={`q-${index}-min`}
                type="number"
                readOnly={locked || readOnly}
                {...register(`questions.${index}.scaleMin`, { valueAsNumber: true })}
              />
              <FieldError message={questionErrors?.scaleMin?.message} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`q-${index}-max`}>Sampai</Label>
              <Input
                id={`q-${index}-max`}
                type="number"
                readOnly={locked || readOnly}
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
              <Checkbox
                checked={field.value}
                disabled={readOnly}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              Wajib diisi
            </label>
          )}
        />
      </CardContent>
    </Card>
  );
}
