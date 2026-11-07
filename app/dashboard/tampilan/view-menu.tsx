"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { filterTriggerClass } from "@/components/filters/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIEW_MAX_AGE_BUCKETS, VIEW_MAX_SUMMARIES } from "@/lib/constants";
import { ageBucketsFromBrackets } from "@/lib/member-view/edit";
import type { LevelOption, TagOption } from "@/lib/member-view/editor-options";
import {
  addSummary,
  choiceShownFor,
  dimensionOfChoice,
  moveSummary,
  removeSummary,
  replaceSummaryDimension,
  summaryChoices,
} from "@/lib/member-view/summary-edit";
import { GROUPABLE_FIELDS, MEMBER_VIEW_FIELDS, SORT_FIELD_KEYS, type SortField } from "@/lib/member-view/fields";
import { MEMBER_COLUMNS, type MemberColumnKey } from "@/lib/member/columns";
import { columnsSchema, groupBySchema, type Definition, type GroupBy } from "@/lib/validation/member-view";
import { ApplyFooter, nativeSelectClass } from "./rule-editor";
import { useDraft } from "./use-draft";

type Buckets = Extract<GroupBy, { kind: "ageBuckets" }>["buckets"];

/** `""` = none, `p:<field>`, `l:<depth>`, or `age`. */
function groupByValue(groupBy: Definition["groupBy"]): string {
  if (!groupBy) return "";
  if (groupBy.kind === "property") return `p:${groupBy.field}`;
  if (groupBy.kind === "groupLevel") return `l:${groupBy.depth}`;
  return "age";
}

/** Rows for editing age buckets; reports upward only once the whole set passes `groupBySchema`. */
function AgeBucketEditor({ buckets, onCommit }: { buckets: Buckets; onCommit: (buckets: Buckets) => void }) {
  const [rows, setRows] = useState(buckets);
  const [error, setError] = useState<string | null>(null);

  function update(next: Buckets) {
    setRows(next);
    const parsed = groupBySchema.safeParse({ kind: "ageBuckets", buckets: next });
    if (parsed.success) {
      setError(null);
      onCommit(next);
    } else {
      setError(parsed.error.issues[0]?.message ?? "Kelompok umur tidak valid");
    }
  }

  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {rows.map((bucket, index) => (
          <li key={`${rows.length}-${index}`} className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
            <Input
              aria-label="Nama kelompok"
              className="min-w-full flex-1 sm:min-w-0"
              defaultValue={bucket.label}
              onBlur={(e) => update(rows.map((b, i) => (i === index ? { ...b, label: e.currentTarget.value } : b)))}
            />
            <Input
              aria-label="Usia minimum"
              type="number"
              min={0}
              className="w-[4.5rem] shrink-0 px-1.5"
              inputMode="numeric"
              defaultValue={bucket.min}
              onBlur={(e) => update(rows.map((b, i) => (i === index ? { ...b, min: Number(e.currentTarget.value) } : b)))}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              aria-label="Usia maksimum (kosong = tanpa batas)"
              type="number"
              min={0}
              className="w-[4.5rem] shrink-0 px-1.5"
              inputMode="numeric"
              placeholder="∞"
              defaultValue={bucket.max ?? ""}
              onBlur={(e) => update(rows.map((b, i) => (i === index ? { ...b, max: num(e.currentTarget.value) } : b)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Hapus kelompok"
              disabled={rows.length <= 1}
              onClick={() => update(rows.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="status" className="text-xs text-destructive">
          Belum diterapkan: {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= VIEW_MAX_AGE_BUCKETS}
          onClick={() => {
            const last = rows[rows.length - 1];
            const min = last?.max === null || last === undefined ? 0 : last.max + 1;
            update([...rows, { label: "Baru", min, max: null }]);
          }}
        >
          <Plus />
          Tambah kelompok
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => update(ageBucketsFromBrackets())}>
          Atur ulang
        </Button>
      </div>
    </div>
  );
}

/**
 * "Tampilan" menu: group-by (incl. age buckets), sort and columns. Edits stay
 * in a local draft; `onChange` is called once, on "Terapkan" or when the menu
 * closes, and only if something changed (task 6.1).
 */
export function ViewMenu({
  definition: appliedDefinition,
  levels,
  tags = [],
  onChange: apply,
}: {
  definition: Definition;
  levels: LevelOption[];
  tags?: TagOption[];
  onChange: (definition: Definition) => void;
}) {
  const draft = useDraft(appliedDefinition, apply);
  const definition = draft.value;
  const onChange = draft.edit;
  const { groupBy, sort, columns } = definition;
  const summaries = definition.summaries ?? [];
  const choices = summaryChoices(levels, tags);

  function setGroupBy(value: string) {
    if (value === "") return onChange({ ...definition, groupBy: undefined });
    if (value === "age") return onChange({ ...definition, groupBy: { kind: "ageBuckets", buckets: ageBucketsFromBrackets() } });
    if (value.startsWith("l:")) return onChange({ ...definition, groupBy: { kind: "groupLevel", depth: Number(value.slice(2)) } });
    onChange({ ...definition, groupBy: { kind: "property", field: value.slice(2) as (typeof GROUPABLE_FIELDS)[number] } });
  }

  function toggleColumn(key: MemberColumnKey, checked: boolean) {
    const next = MEMBER_COLUMNS.map((c) => c.key).filter((k) => (k === key ? checked : columns.includes(k)));
    onChange({ ...definition, columns: columnsSchema.parse(next) });
  }

  return (
    <Popover open={draft.isOpen} onOpenChange={(open) => (open ? draft.begin() : draft.commit())}>
      <PopoverTrigger className={filterTriggerClass()}>
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        Tampilan
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[min(32rem,var(--available-height))] w-[min(25rem,calc(100vw-24px))] flex-col">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">
          <label className="flex flex-col gap-1 text-base xl:text-sm">
            <span className="text-xs font-medium text-muted-foreground">Kelompokkan menurut</span>
            <select className={nativeSelectClass} value={groupByValue(groupBy)} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="">Tanpa pengelompokan</option>
              {GROUPABLE_FIELDS.map((field) => (
                <option key={field} value={`p:${field}`}>
                  {MEMBER_VIEW_FIELDS[field].label}
                </option>
              ))}
              {levels.map((level) => (
                <option key={level.depth} value={`l:${level.depth}`}>
                  Tingkat {level.name}
                </option>
              ))}
              <option value="age">Kelompok umur</option>
            </select>
          </label>

          {groupBy?.kind === "ageBuckets" && (
            <AgeBucketEditor key={JSON.stringify(groupBy.buckets)} buckets={groupBy.buckets} onCommit={(buckets) => onChange({ ...definition, groupBy: { kind: "ageBuckets", buckets } })} />
          )}

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Urutkan</span>
            <div className="flex gap-2">
              <select
                aria-label="Urutkan menurut"
                className={`${nativeSelectClass} flex-1`}
                value={sort.field}
                onChange={(e) => onChange({ ...definition, sort: { ...sort, field: e.target.value as SortField } })}
              >
                {SORT_FIELD_KEYS.map((field) => (
                  <option key={field} value={field}>
                    {MEMBER_VIEW_FIELDS[field].label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Arah urutan"
                className={nativeSelectClass}
                value={sort.dir}
                onChange={(e) => onChange({ ...definition, sort: { ...sort, dir: e.target.value as "asc" | "desc" } })}
              >
                <option value="asc">Naik</option>
                <option value="desc">Turun</option>
              </select>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Ringkasan (maks. {VIEW_MAX_SUMMARIES})</legend>
            <ul className="flex flex-col gap-3">
              {summaries.map((summary, index) => {
                const shown = choiceShownFor(summary.dimension, tags);
                const known = choices.some((c) => c.value === shown);
                return (
                  <li key={index} className="flex flex-col gap-2 rounded-lg border p-2">
                    <div className="flex items-center gap-1">
                      <select
                        aria-label={`Ringkasan ${index + 1}: hitung menurut`}
                        className={`${nativeSelectClass} min-w-0 flex-1`}
                        value={shown}
                        onChange={(e) => {
                          const dimension = dimensionOfChoice(e.target.value);
                          if (dimension) onChange(replaceSummaryDimension(definition, index, dimension));
                        }}
                      >
                        {!known && <option value={shown}>(tidak tersedia)</option>}
                        {choices.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Naikkan ringkasan ${index + 1}`} disabled={index === 0} onClick={() => onChange(moveSummary(definition, index, -1))}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Turunkan ringkasan ${index + 1}`} disabled={index === summaries.length - 1} onClick={() => onChange(moveSummary(definition, index, 1))}>
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus ringkasan ${index + 1}`} onClick={() => onChange(removeSummary(definition, index))}>
                        <Trash2 />
                      </Button>
                    </div>
                    {summary.dimension.kind === "ageBuckets" && (
                      <AgeBucketEditor
                        key={JSON.stringify(summary.dimension.buckets)}
                        buckets={summary.dimension.buckets}
                        onCommit={(buckets) => onChange(replaceSummaryDimension(definition, index, { kind: "ageBuckets", buckets }))}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <Button type="button" variant="outline" size="sm" className="self-start" disabled={summaries.length >= VIEW_MAX_SUMMARIES} onClick={() => onChange(addSummary(definition))}>
              <Plus />
              Tambah ringkasan
            </Button>
          </fieldset>

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Kolom (nama selalu tampil)</legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {MEMBER_COLUMNS.map((column) => (
                <label key={column.key} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-base xl:min-h-0 xl:gap-1.5 xl:text-sm">
                  <input type="checkbox" className="size-5 xl:size-4" checked={columns.includes(column.key)} onChange={(e) => toggleColumn(column.key, e.target.checked)} />
                  {column.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <ApplyFooter onApply={draft.commit} />
      </PopoverContent>
    </Popover>
  );
}
