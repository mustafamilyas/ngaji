import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { TableCard } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { authorize } from "@/lib/authz";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, parsePage } from "@/lib/filters";
import { dateOf } from "@/lib/dates";
import { loadEditorOptions } from "@/lib/member-view/editor-options";
import { listViewMembers } from "@/lib/member-view/results";
import { loadViewDefinition, type LoadedView } from "@/lib/member-view/load";
import type { SessionUser } from "@/lib/auth/session-user";
import { listViewSections } from "@/lib/member-view/sections";
import { pageHref } from "@/lib/pagination";
import { DeleteViewButton } from "./delete-view-button";
import { ViewActions } from "./view-actions";
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

function canTakeOver(user: SessionUser, view: NonNullable<LoadedView["view"]>): boolean {
  try {
    authorize(user, "member_view.transfer", view);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shared body of `/dashboard/tampilan/[id]` and `/dashboard/tampilan/baru` (`viewId` null): header,
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
  const isOwner = view !== null && view.ownerId === Number(session.user.id);
  const canTransfer = view !== null && canTakeOver(session.user, view);
  const basePath = viewId === null ? "/dashboard/tampilan/baru" : `/dashboard/tampilan/${viewId}`;

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
        breadcrumb={[{ label: "Tampilan", href: "/dashboard/tampilan" }, { label: view?.name ?? "Tampilan baru" }]}
        title={view?.name ?? "Tampilan baru"}
        badges={isDraft ? <Badge variant="secondary">Belum disimpan</Badge> : undefined}
        actions={
          <ViewActions
            viewId={viewId}
            viewName={view?.name ?? ""}
            definition={definition}
            basePath={basePath}
            isDraft={isDraft}
            isOwner={isOwner}
            canTransfer={canTransfer}
          />
        }
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

      {isOwner && view && (
        <DangerZone>
          <DangerZoneItem
            title="Hapus tampilan"
            description="Tampilan disembunyikan dari daftar; anggota tidak terpengaruh."
          >
            <DeleteViewButton viewId={view.id} viewName={view.name} />
          </DangerZoneItem>
        </DangerZone>
      )}
    </div>
  );
}
