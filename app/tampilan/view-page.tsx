import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TableCard } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, parsePage } from "@/lib/filters";
import { dateOf } from "@/lib/dates";
import { loadEditorOptions } from "@/lib/member-view/editor-options";
import { listViewMembers } from "@/lib/member-view/results";
import { loadViewDefinition } from "@/lib/member-view/load";
import { listViewSections } from "@/lib/member-view/sections";
import { pageHref } from "@/lib/pagination";
import { ViewToolbar } from "./view-toolbar";
import { ViewSections } from "./view-sections";
import { ViewMembersTable, type ViewMemberRow } from "./view-table";

type SearchParams = Record<string, string | string[] | undefined>;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Shared body of `/tampilan/[id]` and `/tampilan/baru` (`viewId` null): header,
 * notices and the result list. Editing controls (filter bar, menu, save) are
 * separate slices.
 */
export async function ViewPage({ viewId, searchParams }: { viewId: number | null; searchParams: SearchParams }) {
  const session = await auth();
  if (!session) redirect("/login");

  const draftParam = typeof searchParams.d === "string" ? searchParams.d : undefined;
  let loaded;
  try {
    loaded = await loadViewDefinition(session.user, viewId, draftParam);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { view, definition, isDraft, draftUnreadable, warnings } = loaded;
  const asOf = today();
  const basePath = viewId === null ? "/tampilan/baru" : `/tampilan/${viewId}`;

  const options = await loadEditorOptions(session.user);
  const sectionResult = definition.groupBy ? await listViewSections(session.user, definition, { today: asOf }) : null;
  const grouped = sectionResult?.grouped ? sectionResult : null;
  const flat = grouped
    ? null
    : await listViewMembers(session.user, definition, { page: parsePage(searchParams.page), today: asOf });

  const dropped = warnings.length > 0 || Boolean(sectionResult?.dropped) || Boolean(flat?.dropped);
  const levelInvalid = sectionResult && !sectionResult.grouped && sectionResult.levelInvalid;
  const total = grouped ? grouped.sections.reduce((sum, s) => sum + s.count, 0) : flat!.total;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Tampilan", href: "/tampilan" }, { label: view?.name ?? "Tampilan baru" }]}
        title={view?.name ?? "Tampilan baru"}
        badges={isDraft ? <Badge variant="secondary">Belum disimpan</Badge> : undefined}
        meta={
          view ? (
            <>
              <span>Pemilik: {view.ownerName}</span>
              <span>Diperbarui {formatDate(dateOf(view.updatedAt))}</span>
            </>
          ) : undefined
        }
      />

      <ViewToolbar definition={definition} options={options} basePath={basePath} />

      {draftUnreadable && <Notice>Perubahan pada tautan tidak dapat dibaca. Menampilkan tampilan tersimpan.</Notice>}
      {dropped && <Notice>Beberapa aturan diabaikan karena tidak berlaku lagi.</Notice>}
      {levelInvalid && <Notice>Pengelompokan menurut tingkat grup tidak berlaku untuk akun Anda.</Notice>}

      {grouped ? (
        grouped.sections.length > 0 ? (
          <ViewSections
            sections={grouped.sections}
            columns={definition.columns}
            asOf={asOf}
            viewId={viewId}
            draft={isDraft ? draftParam : undefined}
          />
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
        )
      ) : (
        <TableCard
          title={
            <>
              Hasil: <span className="font-medium text-foreground">{total} anggota</span>
            </>
          }
          footer={
            flat!.total > flat!.pageSize ? (
              <Pagination
                page={flat!.page}
                pageSize={flat!.pageSize}
                total={flat!.total}
                hrefFor={(target) => pageHref(basePath, searchParams, target)}
              />
            ) : undefined
          }
        >
          {flat!.members.length > 0 ? (
            <ViewMembersTable members={flat!.members as unknown as ViewMemberRow[]} columns={definition.columns} asOf={asOf} />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
          )}
        </TableCard>
      )}
    </div>
  );
}
