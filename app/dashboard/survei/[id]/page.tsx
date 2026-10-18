import { notFound, redirect } from "next/navigation";
import { BarChart3, FilePenLine, Info, Network, Users } from "lucide-react";
import { auth } from "@/auth";
import { MetaItem, PageHeader } from "@/components/page-header";
import { TabNav, type TabItem } from "@/components/tab-nav";
import { Badge } from "@/components/ui/badge";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { loadSurveyDetail } from "@/lib/survey/detail";
import { listRespondents } from "@/lib/survey/respondents";
import { parseSurveyDemographics, surveyStatistics } from "@/lib/survey/stats";
import { parseTab } from "@/lib/tabs";
import { SurveyForm } from "../survey-form";
import { RespondentsTab } from "./respondents-tab";
import { ResultsTab } from "./results-tab";

const TABS = ["hasil", "responden", "formulir"] as const;
type Tab = (typeof TABS)[number];

export default async function SurveyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const surveyId = Number(id);
  if (!Number.isInteger(surveyId)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let detail;
  try {
    detail = await loadSurveyDetail(session.user, surveyId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { survey, form, canEdit, inherited, responseCount, lockedQuestionIds, lockedOptionIds } = detail;

  const query = await searchParams;
  const path = `/dashboard/survei/${survey.id}`;
  const tabs: TabItem<Tab>[] = [
    { key: "hasil", label: "Hasil", icon: BarChart3 },
    { key: "responden", label: "Responden", icon: Users, count: responseCount },
    { key: "formulir", label: "Formulir", icon: FilePenLine },
  ];
  const tab = parseTab(query.tab, TABS, "hasil");

  const groupIds = parseGroupIds(query.grup);
  const search = parseSearch(query.q);
  let respondents;
  if (tab === "responden") {
    try {
      respondents = await listRespondents(session.user, surveyId, { groupIds, search, page: parsePage(query.page) });
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  }

  const demographics = parseSurveyDemographics({
    jk: firstParam(query.jk),
    umur: firstParam(query.umur),
    kerja: firstParam(query.kerja),
    nikah: firstParam(query.nikah),
  });
  const statsGroupId = groupIds?.[0];
  let stats;
  if (tab === "hasil") {
    try {
      stats = await surveyStatistics(session.user, surveyId, {
        groupId: statsGroupId,
        demographics,
        search,
        nonRespondentPage: parsePage(query.page),
        text: parseTextPage(query.teks),
      });
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  }
  const visibleGroups =
    tab === "responden" || tab === "hasil"
      ? await db.group.findMany({
          where: visibleGroupsWhere(session.user),
          orderBy: [{ depth: "asc" }, { name: "asc" }],
          select: { id: true, parentId: true, name: true, path: true },
        })
      : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Survei", href: "/dashboard/survei" }, { label: survey.title }]}
        title={survey.title}
        badges={inherited && <Badge variant="secondary">Diwarisi</Badge>}
        meta={<MetaItem icon={Network}>{survey.group.name}</MetaItem>}
      />

      {survey.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{survey.description}</p>}

      <div className="flex flex-col gap-4">
        <TabNav path={path} tabs={tabs} current={tab} defaultTab="hasil" />

        {stats && (
          <ResultsTab
            surveyId={survey.id}
            stats={stats}
            groups={visibleGroups}
            params={query}
            search={search}
            groupActive={statsGroupId !== undefined}
            demographics={demographics}
          />
        )}
        {respondents && (
          <RespondentsTab
            surveyId={survey.id}
            list={respondents}
            groups={visibleGroups}
            params={query}
            search={search}
            groupIds={groupIds}
          />
        )}

        {tab === "formulir" && (
          <>
            {!canEdit && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Formulir ini hanya bisa diubah oleh admin {survey.group.name}.
              </p>
            )}
            {canEdit && lockedQuestionIds.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Sebagian pertanyaan sudah dijawab: jenis dan rentang skalanya terkunci, dan hanya bisa diarsipkan.
              </p>
            )}
            <SurveyForm
              surveyId={survey.id}
              defaultValues={form}
              lockedQuestionIds={lockedQuestionIds}
              lockedOptionIds={lockedOptionIds}
              readOnly={!canEdit}
            />
          </>
        )}
      </div>
    </div>
  );
}

function firstParam(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/** `?teks=<questionId>:<page>` — the one text list that paginates; anything malformed is ignored. */
function parseTextPage(param: string | string[] | undefined): { questionId: number; page: number } | undefined {
  const match = /^(\d+):(\d+)$/.exec(firstParam(param) ?? "");
  if (!match) return undefined;
  const questionId = Number(match[1]);
  const page = Number(match[2]);
  return questionId > 0 && page >= 1 ? { questionId, page } : undefined;
}
