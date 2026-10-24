import Link from "next/link";
import { Info, ListChecks, Percent, UserX, Users } from "lucide-react";
import { TableCard, StatTile, StatTiles, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/filters/filter-bar";
import { GroupFilter, type FilterGroup } from "@/components/filters/group-filter";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGE_BRACKETS } from "@/lib/constants";
import { dateOf } from "@/lib/dates";
import { formatDate } from "@/lib/filters";
import { SEX_LABELS, formatEnumLabel } from "@/lib/member/labels";
import { pageHref } from "@/lib/pagination";
import type { BreakdownRow, QuestionResult, SurveyDemographics, SurveyStatistics } from "@/lib/survey/stats";
import { cn } from "@/lib/utils";
import { MARITAL_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import { ResultChart } from "./result-chart";

type Params = Record<string, string | string[] | undefined>;

// Below md the same table markup is laid out as one card per row (no sideways scrolling); header cells are table-only.
const stackedCell =
  "col-span-2 flex items-center justify-between gap-3 px-0 py-0 text-sm whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap";

function PhoneLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground md:hidden">{children}</span>;
}

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function textPageHref(path: string, params: Params, questionId: number, page: number): string {
  const next = { ...params, teks: page > 1 ? `${questionId}:${page}` : undefined };
  return pageHref(path, next, 1);
}

/** "Hasil" tab: response rate, non-respondents, per-question results and the per-sub-group breakdown. */
export function ResultsTab({
  surveyId,
  stats,
  groups,
  params,
  search,
  groupActive,
  demographics,
  timeZone,
}: {
  surveyId: number;
  stats: SurveyStatistics;
  groups: FilterGroup[];
  params: Params;
  search?: string;
  /** `?grup=` was given; otherwise the selected group is the page default. */
  groupActive: boolean;
  demographics: SurveyDemographics;
  /** Organization timezone the free-text answer dates are shown in. */
  timeZone: string;
}) {
  const path = `/dashboard/survei/${surveyId}`;
  const isFiltered = Boolean(search || groupActive || Object.keys(demographics).length > 0);
  const { rate, questions, breakdown } = stats;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar action={path} preserve={{ tab: "hasil" }} isFiltered={isFiltered} resetHref={path}>
        <GroupFilter
          groups={groups}
          selected={[stats.group.id]}
          active={groupActive}
          mode="single"
          hint="Hasil dihitung untuk grup terpilih beserta turunannya."
        />
        <SelectFilter
          name="jk"
          label="Jenis kelamin"
          allLabel="Semua jenis kelamin"
          value={demographics.sex}
          options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
        />
        <SelectFilter
          name="umur"
          label="Kelompok umur"
          allLabel="Semua umur"
          value={demographics.ageBracket}
          options={AGE_BRACKETS.map((b) => ({ value: b.label, label: formatEnumLabel(b.label) }))}
        />
        <SelectFilter
          name="kerja"
          label="Status kerja"
          allLabel="Semua status kerja"
          value={demographics.workStatus}
          options={WORK_STATUSES.map((s) => ({ value: s, label: formatEnumLabel(s) }))}
        />
        <SelectFilter
          name="nikah"
          label="Status pernikahan"
          allLabel="Semua status nikah"
          value={demographics.maritalStatus}
          options={MARITAL_STATUSES.map((s) => ({ value: s, label: formatEnumLabel(s) }))}
        />
        <SearchFilter value={search} placeholder="Cari yang belum mengisi…" />
      </FilterBar>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Data dalam cakupan Anda · {stats.group.name}
      </p>

      <StatTiles>
        <StatTile
          icon={Percent}
          label="Tingkat respons"
          value={`${number.format(rate.percent)}%`}
          hint={`${rate.answered} dari ${rate.expected} anggota aktif`}
        />
        <StatTile icon={Users} label="Anggota aktif" value={rate.expected} />
        <StatTile icon={ListChecks} label="Sudah mengisi" value={rate.answered} />
        <StatTile icon={UserX} label="Belum mengisi" value={rate.expected - rate.answered} />
      </StatTiles>

      {questions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Survei ini belum punya pertanyaan.</p>
      ) : (
        questions.map((question, index) => (
          <QuestionCard key={question.id} number={index + 1} question={question} path={path} params={params} timeZone={timeZone} />
        ))
      )}

      {breakdown && <Breakdown rows={breakdown} questions={questions} />}

      <NonRespondents surveyId={surveyId} stats={stats} params={params} search={search} />
    </div>
  );
}

function NonRespondents({
  surveyId,
  stats,
  params,
  search,
}: {
  surveyId: number;
  stats: SurveyStatistics;
  params: Params;
  search?: string;
}) {
  const path = `/dashboard/survei/${surveyId}`;
  const { nonRespondents, canRecord } = stats;

  return (
    <TableCard
      title={
        <span>
          <span className="font-medium text-foreground">{nonRespondents.total}</span> belum mengisi
        </span>
      }
      footer={
        nonRespondents.total > nonRespondents.pageSize ? (
          <Pagination
            page={nonRespondents.page}
            pageSize={nonRespondents.pageSize}
            total={nonRespondents.total}
            hrefFor={(target) => pageHref(path, params, target)}
          />
        ) : undefined
      }
    >
      {nonRespondents.rows.length > 0 ? (
        <div className="relative overflow-x-auto">
          <table className={cn(tableClass, "block md:table")}>
            <thead className="hidden md:table-header-group">
              <tr className={theadRowClass}>
                <th scope="col" className={thClass}>Nama</th>
                <th scope="col" className={thClass}>Grup</th>
                {canRecord && (
                  <th scope="col" className={thClass}>
                    <span className="sr-only">Aksi</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {nonRespondents.rows.map((row) => (
                <tr
                  key={row.memberId}
                  className={cn(trClass, "grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-4 py-2 md:table-row md:p-0")}
                >
                  <td className={cn(tdClass, "block min-w-0 p-0 whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap")}>
                    <span className="font-medium">{row.name}</span>
                  </td>
                  <td className={stackedCell}>
                    <PhoneLabel>Grup</PhoneLabel>
                    <span>{row.groupName}</span>
                  </td>
                  {canRecord && (
                    <td className="col-start-2 row-start-1 p-0 text-right whitespace-nowrap md:px-2 md:py-1">
                      <Link
                        href={`${path}/isi?anggota=${row.memberId}`}
                        aria-label={`Isi survei untuk ${row.name}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 px-4 text-base xl:h-7 xl:px-2.5 xl:text-[0.8rem]")}
                      >
                        Isi
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {search ? "Tidak ada yang cocok." : "Semua anggota aktif sudah mengisi."}
        </p>
      )}
    </TableCard>
  );
}

function QuestionCard({
  number: position,
  question,
  path,
  params,
  timeZone,
}: {
  number: number;
  question: QuestionResult;
  path: string;
  params: Params;
  timeZone: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>
            {position}. {question.label}
          </span>
          {question.archived && <Badge variant="secondary">Diarsipkan</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {question.answeredCount} jawaban
          {question.helpText ? ` · ${question.helpText}` : ""}
        </p>
      </CardHeader>
      <CardContent>
        {question.answeredCount === 0 ? (
          <p role="status" className="py-4 text-center text-sm text-muted-foreground">
            Belum ada jawaban
          </p>
        ) : (
          <QuestionBody question={question} path={path} params={params} timeZone={timeZone} />
        )}
      </CardContent>
    </Card>
  );
}

function QuestionBody({ question, path, params, timeZone }: { question: QuestionResult; path: string; params: Params; timeZone: string }) {
  switch (question.type) {
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (
        <ResultChart
          orientation="horizontal"
          ariaLabel={`Jawaban untuk ${question.label}`}
          data={question.options.map((o) => ({
            label: o.archived ? `${o.label} (arsip)` : o.label,
            count: o.count,
            percent: o.percent,
          }))}
        />
      );
    case "SCALE":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Rata-rata <span className="font-medium tabular-nums">{question.average === null ? "-" : number.format(question.average)}</span>
          </p>
          <ResultChart
            orientation="vertical"
            ariaLabel={`Sebaran jawaban untuk ${question.label}`}
            data={question.distribution.map((d) => ({ label: String(d.value), count: d.count }))}
          />
        </div>
      );
    case "NUMBER":
      return (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          {[
            ["Rata-rata", question.average],
            ["Terkecil", question.min],
            ["Terbesar", question.max],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value === null ? "-" : number.format(Number(value))}</dd>
            </div>
          ))}
        </dl>
      );
    default:
      return (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y rounded-lg border">
            {question.answers.map((answer, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                <span className="whitespace-pre-line">{answer.text}</span>
                <span className="text-xs text-muted-foreground">
                  {answer.memberName} · {formatDate(dateOf(answer.updatedAt, timeZone))}
                </span>
              </li>
            ))}
          </ul>
          {question.total > question.pageSize && (
            <Pagination
              page={question.page}
              pageSize={question.pageSize}
              total={question.total}
              hrefFor={(target) => textPageHref(path, params, question.id, target)}
            />
          )}
        </div>
      );
  }
}

function Breakdown({ rows, questions }: { rows: BreakdownRow[]; questions: QuestionResult[] }) {
  if (rows.length === 0) return null;
  const choiceLike = questions.filter((q) => q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE" || q.type === "SCALE");

  return (
    <section aria-labelledby="breakdown-title" className="flex flex-col gap-4">
      <TableCard title={<h2 id="breakdown-title" className="font-medium text-foreground">Per sub-grup</h2>}>
        <div className="relative overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr className={theadRowClass}>
                <th scope="col" className={thClass}>Sub-grup</th>
                <th scope="col" className={`${thClass} text-right`}>Anggota aktif</th>
                <th scope="col" className={`${thClass} text-right`}>Sudah mengisi</th>
                <th scope="col" className={`${thClass} text-right`}>Respons</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.groupId} className={trClass}>
                  <td className={`${tdClass} font-medium`}>{row.groupName}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{row.rate.expected}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{row.rate.answered}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{number.format(row.rate.percent)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCard>

      {choiceLike.map((question) => (
        <details key={question.id} className="rounded-xl bg-card ring-1 ring-foreground/10">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-medium">
            {question.label} · per sub-grup
          </summary>
          <div className="relative overflow-x-auto border-t">
            <BreakdownQuestionTable question={question} rows={rows} />
          </div>
        </details>
      ))}
    </section>
  );
}

function BreakdownQuestionTable({ question, rows }: { question: QuestionResult; rows: BreakdownRow[] }) {
  const columns =
    question.type === "SCALE"
      ? question.distribution.map((d) => ({ key: `v${d.value}`, label: String(d.value) }))
      : question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE"
        ? question.options.map((o) => ({ key: `o${o.optionId}`, label: o.archived ? `${o.label} (arsip)` : o.label }))
        : [];

  function cells(row: BreakdownRow): Map<string, number> {
    const entry = row.questions.find((q) => q.questionId === question.id);
    const map = new Map<string, number>();
    if (!entry) return map;
    if (entry.type === "SCALE") for (const d of entry.distribution) map.set(`v${d.value}`, d.count);
    else for (const o of entry.options) map.set(`o${o.optionId}`, o.count);
    return map;
  }

  return (
    <table className={tableClass}>
      <thead>
        <tr className={theadRowClass}>
          <th scope="col" className={thClass}>Sub-grup</th>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={`${thClass} text-right`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const counts = cells(row);
          return (
            <tr key={row.groupId} className={trClass}>
              <td className={`${tdClass} font-medium`}>{row.groupName}</td>
              {columns.map((c) => (
                <td key={c.key} className={`${tdClass} text-right tabular-nums`}>
                  {counts.get(c.key) ?? 0}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
