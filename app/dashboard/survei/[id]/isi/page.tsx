import { notFound, redirect } from "next/navigation";
import { Network } from "lucide-react";
import { auth } from "@/auth";
import { MetaItem, PageHeader } from "@/components/page-header";
import { NotFoundError } from "@/lib/errors";
import { loadSurveyEntry } from "@/lib/survey/entry";
import { EntryForm } from "./entry-form";

function parseId(value: string | string[] | undefined): number | undefined {
  const id = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Enter or correct one member's answers. Users above the owning group can
 * only view, so they are sent back to the survey (like the check-in page).
 */
export default async function SurveyEntryPage({
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

  const query = await searchParams;
  let entry;
  try {
    entry = await loadSurveyEntry(session.user, surveyId, parseId(query.anggota));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (!entry.canRecord) redirect(`/dashboard/survei/${surveyId}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Survei", href: "/dashboard/survei" },
          { label: entry.survey.title, href: `/dashboard/survei/${surveyId}` },
          { label: "Isi survei" },
        ]}
        title="Isi survei"
        meta={
          <>
            <span>{entry.survey.title}</span>
            <MetaItem icon={Network}>{entry.survey.groupName}</MetaItem>
          </>
        }
      />
      <EntryForm
        surveyId={surveyId}
        members={entry.members}
        questions={entry.questions}
        answers={entry.answers}
        selectedMemberId={entry.selectedMemberId}
      />
    </div>
  );
}
