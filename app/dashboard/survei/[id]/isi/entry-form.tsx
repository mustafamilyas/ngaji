"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Info, Save } from "lucide-react";
import { saveSurveyResponseAction } from "@/app/dashboard/survei/actions";
import { Autocomplete, type AutocompleteItem } from "@/components/autocomplete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LONG_TEXT_MAX, SHORT_TEXT_MAX } from "@/lib/constants";
import type { SubmittedAnswer } from "@/lib/survey/answers";
import type { EntryMember, EntryQuestion } from "@/lib/survey/entry";
import { cn } from "@/lib/utils";

const SAVED_TOAST_MS = 4000;

/** Editable state of one question; numbers stay strings while typing. */
type Draft = { optionIds: number[]; value: string };
type Drafts = Record<number, Draft>;

function draftsFrom(questions: EntryQuestion[], answers: SubmittedAnswer[]): Drafts {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  return Object.fromEntries(
    questions.map((q) => {
      const a = byQuestion.get(q.id);
      return [q.id, { optionIds: a?.optionIds ?? [], value: a?.number !== undefined ? String(a.number) : (a?.text ?? "") }];
    }),
  );
}

function isEmpty(q: EntryQuestion, d: Draft): boolean {
  return q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE" ? d.optionIds.length === 0 : d.value.trim() === "";
}

/** Empty answers are omitted; archived options are never resubmitted (the server keeps those picks). */
function toSubmitted(questions: EntryQuestion[], drafts: Drafts): SubmittedAnswer[] {
  const out: SubmittedAnswer[] = [];
  for (const q of questions) {
    if (q.archived) continue;
    const d = drafts[q.id];
    if (!d || isEmpty(q, d)) continue;
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") {
      const archivedIds = new Set(q.options.filter((o) => o.archived).map((o) => o.id));
      const optionIds = d.optionIds.filter((id) => !archivedIds.has(id));
      if (optionIds.length > 0) out.push({ questionId: q.id, optionIds });
    } else if (q.type === "NUMBER" || q.type === "SCALE") {
      out.push({ questionId: q.id, number: Number(d.value) });
    } else {
      out.push({ questionId: q.id, text: d.value.trim() });
    }
  }
  return out;
}

export function EntryForm({
  surveyId,
  members,
  questions,
  answers,
  selectedMemberId,
}: {
  surveyId: number;
  members: EntryMember[];
  questions: EntryQuestion[];
  answers: SubmittedAnswer[];
  selectedMemberId?: number;
}) {
  const router = useRouter();
  const base = `/dashboard/survei/${surveyId}/isi`;
  const selected = members.find((m) => m.id === selectedMemberId);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [choosing, startChoosing] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const items = useMemo<AutocompleteItem[]>(
    () => members.map((m) => ({ id: m.id, label: m.name, hint: m.groupName, badge: m.hasResponse ? "Sudah mengisi" : undefined })),
    [members],
  );

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  function choose(item: AutocompleteItem) {
    setQuery(item.label);
    setSaved(null);
    startChoosing(() => router.replace(`${base}?anggota=${item.id}`));
  }

  function onQueryChange(value: string) {
    setQuery(value);
    // Editing the name drops the chosen member (and the form below it).
    if (selected) startChoosing(() => router.replace(base));
  }

  function afterSave(memberName: string) {
    setSaved(memberName);
    setQuery("");
    startChoosing(() => {
      router.replace(base);
      router.refresh();
    });
    setTimeout(() => nameRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-4">
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Check aria-hidden className="size-4 shrink-0 text-primary" />
          Jawaban {saved} tersimpan.
        </p>
      )}

      <Autocomplete
        id="member"
        label="Anggota"
        items={items}
        query={query}
        onQueryChange={onQueryChange}
        selectedId={selected?.id}
        onSelect={choose}
        placeholder="Ketik nama anggota"
        openOnFocus
        inputRef={nameRef}
        autoFocus={!selected}
      />

      {members.length === 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Belum ada anggota aktif di cakupan Anda.
        </p>
      )}

      {selected && (
        // Remount per member so drafts always start from that member's stored answers.
        <AnswerForm
          key={selected.id}
          surveyId={surveyId}
          member={selected}
          questions={questions}
          answers={answers}
          busy={choosing}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}

function AnswerForm({
  surveyId,
  member,
  questions,
  answers,
  busy,
  onSaved,
}: {
  surveyId: number;
  member: EntryMember;
  questions: EntryQuestion[];
  answers: SubmittedAnswer[];
  busy: boolean;
  onSaved: (memberName: string) => void;
}) {
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFrom(questions, answers));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(questionId: number, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => Number(id) !== questionId)));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<number, string> = {};
    for (const q of questions) {
      if (q.archived) continue;
      const d = drafts[q.id];
      if (q.required && isEmpty(q, d)) found[q.id] = "Wajib diisi";
      else if ((q.type === "NUMBER" || q.type === "SCALE") && !isEmpty(q, d) && !Number.isFinite(Number(d.value))) {
        found[q.id] = "Isi dengan angka";
      }
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    startTransition(async () => {
      const result = await saveSurveyResponseAction({
        surveyId,
        memberId: member.id,
        answers: toSubmitted(questions, drafts),
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      onSaved(member.name);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {member.name} · {member.groupName}
        </span>
        {member.hasResponse && <Badge variant="secondary">Mengubah jawaban</Badge>}
      </div>

      {questions.map((q, i) => (
        <QuestionField
          key={q.id}
          index={i}
          question={q}
          draft={drafts[q.id]}
          error={errors[q.id]}
          onChange={(patch) => update(q.id, patch)}
        />
      ))}

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      {/* Sticky so the save button stays under the thumb on a long form. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending || busy}>
          <Save />
          {pending ? "Menyimpan…" : "Simpan & anggota berikutnya"}
        </Button>
      </div>
    </form>
  );
}

function QuestionField({
  index,
  question: q,
  draft,
  error,
  onChange,
}: {
  index: number;
  question: EntryQuestion;
  draft: Draft;
  error?: string;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const inputId = `q-${q.id}`;
  const readOnly = q.archived;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-3" disabled={readOnly} aria-describedby={error ? `${inputId}-error` : undefined}>
          <legend className="flex flex-wrap items-baseline gap-x-2 text-base font-medium">
            <span>
              {index + 1}. {q.label}
              {q.required && !readOnly && <span aria-label="wajib"> *</span>}
            </span>
            {readOnly && <Badge variant="outline">Diarsipkan</Badge>}
          </legend>
          {q.helpText && <p className="text-sm text-muted-foreground">{q.helpText}</p>}

          {(q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") && (
            <div className="flex flex-col gap-2">
              {q.options.map((o) => {
                const multi = q.type === "MULTI_CHOICE";
                const checked = draft.optionIds.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-base has-disabled:cursor-default has-disabled:opacity-70",
                      checked && "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={inputId}
                      checked={checked}
                      disabled={readOnly || o.archived}
                      onChange={() =>
                        onChange({
                          optionIds: multi
                            ? checked
                              ? draft.optionIds.filter((id) => id !== o.id)
                              : [...draft.optionIds, o.id]
                            : [o.id],
                        })
                      }
                      className="size-5 accent-primary"
                    />
                    <span className="min-w-0 flex-1">{o.label}</span>
                    {o.archived && <Badge variant="outline">Diarsipkan</Badge>}
                  </label>
                );
              })}
            </div>
          )}

          {q.type === "SCALE" && q.scaleMin !== null && q.scaleMax !== null && (
            <div role="radiogroup" aria-label={q.label} className="flex flex-wrap gap-2">
              {Array.from({ length: q.scaleMax - q.scaleMin + 1 }, (_, k) => q.scaleMin! + k).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={draft.value === String(n)}
                  disabled={readOnly}
                  onClick={() => onChange({ value: draft.value === String(n) ? "" : String(n) })}
                  className={cn(
                    "size-12 rounded-xl border text-base font-medium transition-colors disabled:opacity-70",
                    draft.value === String(n) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {q.type === "NUMBER" && (
            <Input
              id={inputId}
              type="number"
              inputMode="decimal"
              className="h-12 text-base md:text-base"
              value={draft.value}
              disabled={readOnly}
              aria-label={q.label}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ value: e.target.value })}
            />
          )}

          {q.type === "SHORT_TEXT" && (
            <Input
              id={inputId}
              className="h-12 text-base md:text-base"
              value={draft.value}
              maxLength={SHORT_TEXT_MAX}
              disabled={readOnly}
              aria-label={q.label}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ value: e.target.value })}
            />
          )}

          {q.type === "LONG_TEXT" && (
            <Textarea
              id={inputId}
              rows={4}
              className="text-base md:text-base xl:text-sm"
              value={draft.value}
              maxLength={LONG_TEXT_MAX}
              disabled={readOnly}
              aria-label={q.label}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ value: e.target.value })}
            />
          )}
        </fieldset>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
