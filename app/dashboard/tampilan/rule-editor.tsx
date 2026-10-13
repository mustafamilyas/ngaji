"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VIEW_MAX_RULES_PER_GROUP } from "@/lib/constants";
import { choiceLabel, initialRuleValue, OPERATOR_LABELS } from "@/lib/member-view/edit";
import type { GroupOption } from "@/lib/member-view/editor-options";
import { MEMBER_VIEW_FIELDS, operatorsFor, RULE_FIELD_KEYS, type FieldKey, type Operator } from "@/lib/member-view/fields";
import { cn } from "@/lib/utils";
import { ruleSchema, type Conjunction, type Rule, type RuleGroup } from "@/lib/validation/member-view";

export const nativeSelectClass =
  "h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Uncontrolled input that reports its value on blur or Enter, so typing never re-renders the page per keystroke. */
function CommitInput({
  defaultValue,
  onCommit,
  className,
  ...props
}: { defaultValue: string; onCommit: (value: string) => void } & Omit<React.ComponentProps<"input">, "defaultValue" | "onBlur">) {
  return (
    <Input
      {...props}
      defaultValue={defaultValue}
      className={className}
      onBlur={(event) => onCommit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(event.currentTarget.value);
        }
      }}
    />
  );
}

type OperatorKind = "between" | "withinLastDays" | "none" | "single";

function kindOf(operator: Operator): OperatorKind {
  if (operator === "between") return "between";
  if (operator === "withinLastDays") return "withinLastDays";
  if (operator === "isEmpty" || operator === "isNotEmpty") return "none";
  return "single";
}

type DraftRule = { field: FieldKey; operator: Operator; value: unknown };

function GroupPicker({ options, selected, onChange }: { options: GroupOption[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const shown = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 100);
  return (
    <div className="flex flex-col gap-1.5">
      <Input type="search" placeholder="Cari grup…" aria-label="Cari grup" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="max-h-40 overflow-y-auto rounded-lg border p-1">
        {shown.map((option) => (
          <li key={option.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={(e) => onChange(e.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))}
              />
              {option.label}
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-1 text-sm text-muted-foreground">Tidak ada grup.</li>}
      </ul>
    </div>
  );
}

function ValueInput({ draft, groups, onChange }: { draft: DraftRule; groups: GroupOption[]; onChange: (value: unknown) => void }) {
  const def = MEMBER_VIEW_FIELDS[draft.field];
  const kind = kindOf(draft.operator);
  const id = `${draft.field}-${draft.operator}`;
  if (kind === "none") return null;

  switch (def.type) {
    case "choice": {
      const selected = (draft.value as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {def.values.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={(e) =>
                  onChange(def.values.filter((v) => (v === value ? e.target.checked : selected.includes(v))))
                }
              />
              {choiceLabel(draft.field, value)}
            </label>
          ))}
        </div>
      );
    }
    case "text":
      return (
        <CommitInput key={id} aria-label={def.label} defaultValue={String(draft.value ?? "")} onCommit={onChange} placeholder="Ketik lalu Enter" />
      );
    case "group":
      return <GroupPicker options={groups} selected={(draft.value as number[]) ?? []} onChange={onChange} />;
    case "age": {
      if (kind === "between") {
        const [min, max] = (draft.value as number[]) ?? [0, 0];
        const parse = (v: string) => (v === "" ? Number.NaN : Number(v));
        return (
          <div className="flex items-center gap-2">
            <CommitInput key={`${id}-min`} aria-label="Usia minimum" type="number" min={0} defaultValue={String(min)} onCommit={(v) => onChange([parse(v), max])} />
            <span className="text-sm text-muted-foreground">dan</span>
            <CommitInput key={`${id}-max`} aria-label="Usia maksimum" type="number" min={0} defaultValue={String(max)} onCommit={(v) => onChange([min, parse(v)])} />
          </div>
        );
      }
      return (
        <CommitInput key={id} aria-label="Usia" type="number" min={0} defaultValue={String(draft.value ?? "")} onCommit={(v) => onChange(v === "" ? Number.NaN : Number(v))} />
      );
    }
    case "date":
    case "nullableDate":
      if (kind === "withinLastDays") {
        return (
          <div className="flex items-center gap-2">
            <CommitInput key={id} aria-label="Jumlah hari" type="number" min={1} defaultValue={String(draft.value ?? "")} onCommit={(v) => onChange(v === "" ? Number.NaN : Number(v))} />
            <span className="text-sm text-muted-foreground">hari</span>
          </div>
        );
      }
      if (kind === "between") {
        const [from, to] = (draft.value as string[]) ?? ["", ""];
        return (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Dari tanggal" value={from} onChange={(e) => onChange([e.target.value, to])} />
            <span className="text-sm text-muted-foreground">s/d</span>
            <Input type="date" aria-label="Sampai tanggal" value={to} onChange={(e) => onChange([from, e.target.value])} />
          </div>
        );
      }
      return <Input type="date" aria-label={def.label} value={String(draft.value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * One editable rule. Keeps the in-progress rule locally and reports it upward
 * (`onCommit`) only once it passes the shared `ruleSchema`; until then it shows
 * why it is not applied yet.
 */
function RuleRow({
  rule,
  groups,
  onCommit,
  onRemove,
}: {
  rule: Rule;
  groups: GroupOption[];
  onCommit: (rule: Rule) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<DraftRule>({ field: rule.field, operator: rule.operator, value: rule.value });
  const [error, setError] = useState<string | null>(null);

  function update(next: DraftRule) {
    setDraft(next);
    const parsed = ruleSchema.safeParse(next);
    if (parsed.success) {
      setError(null);
      onCommit(parsed.data);
    } else {
      setError(parsed.error.issues[0]?.message ?? "Aturan belum lengkap");
    }
  }

  const operators = operatorsFor(draft.field);
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-background p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Kolom"
          className={nativeSelectClass}
          value={draft.field}
          onChange={(e) => {
            const field = e.target.value as FieldKey;
            const operator = operatorsFor(field)[0];
            update({ field, operator, value: initialRuleValue(field, operator) });
          }}
        >
          {RULE_FIELD_KEYS.map((key) => (
            <option key={key} value={key}>
              {MEMBER_VIEW_FIELDS[key].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Operator"
          className={nativeSelectClass}
          value={draft.operator}
          onChange={(e) => {
            const operator = e.target.value as Operator;
            const keep = kindOf(operator) === kindOf(draft.operator) && kindOf(operator) !== "none";
            update({ field: draft.field, operator, value: keep ? draft.value : initialRuleValue(draft.field, operator) });
          }}
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </select>
        <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" aria-label="Hapus aturan" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      <ValueInput draft={draft} groups={groups} onChange={(value) => update({ ...draft, value })} />
      {error && (
        <p role="status" className="text-xs text-destructive">
          Belum diterapkan: {error}
        </p>
      )}
    </li>
  );
}

/** Editor for one rule group: its AND/OR toggle, its rules, and "Tambah aturan". */
export function RuleGroupEditor({
  group,
  groups,
  onChange,
  onRemove,
  className,
}: {
  group: RuleGroup;
  groups: GroupOption[];
  onChange: (group: RuleGroup) => void;
  onRemove: () => void;
  className?: string;
}) {
  const setRules = (rules: Rule[]) => (rules.length === 0 ? onRemove() : onChange({ ...group, rules }));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {group.rules.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          Aturan di grup ini:
          <select
            aria-label="Gabungkan aturan"
            className={nativeSelectClass}
            value={group.op}
            onChange={(e) => onChange({ ...group, op: e.target.value as Conjunction })}
          >
            <option value="AND">Semua berlaku (DAN)</option>
            <option value="OR">Salah satu berlaku (ATAU)</option>
          </select>
        </label>
      )}
      <ul className="flex flex-col gap-2">
        {group.rules.map((rule, index) => (
          <RuleRow
            key={`${group.rules.length}-${index}`}
            rule={rule}
            groups={groups}
            onCommit={(next) => setRules(group.rules.map((r, i) => (i === index ? next : r)))}
            onRemove={() => setRules(group.rules.filter((_, i) => i !== index))}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={group.rules.length >= VIEW_MAX_RULES_PER_GROUP}
          onClick={() =>
            setRules([...group.rules, { field: "status", operator: "isAnyOf", value: ["AKTIF"] }])
          }
        >
          <Plus />
          Tambah aturan
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Hapus filter
        </Button>
      </div>
    </div>
  );
}
