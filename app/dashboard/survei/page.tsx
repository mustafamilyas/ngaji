import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardList, ClipboardPenLine, Eye, FilePenLine, Inbox, Network, Plus, Users } from "lucide-react";
import { auth } from "@/auth";
import { SortableTh, StatTile, StatTiles, TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { SortSelect } from "@/components/filters/sort-select";
import { MetaItem, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { RowActions, type RowAction } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { canEditSurvey, visibleGroupsWhere } from "@/lib/authz";
import { dateOf } from "@/lib/dates";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { formatDate, parseGroupIds, parsePage, parseSearch } from "@/lib/filters";
import { pageHref } from "@/lib/pagination";
import { parseSort, sortHref } from "@/lib/sort";
import { listSurveys } from "@/lib/survey/list";
import { DEFAULT_SURVEY_SORT, SURVEY_SORT_KEYS, type SurveySortKey } from "@/lib/survey/list-sort";
import { cn } from "@/lib/utils";

// Below md the same table markup is laid out as one card per survey (no sideways scrolling); sort headers are table-only.
const stackedCell =
  "col-span-2 flex items-center justify-between gap-3 px-0 py-0 text-sm whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap";

function PhoneLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground md:hidden">{children}</span>;
}

export default async function SurveyListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user;

  const params = await searchParams;
  const groupIds = parseGroupIds(params.grup);
  const q = parseSearch(params.q);
  const page = parsePage(params.page);
  const sort = parseSort(params, SURVEY_SORT_KEYS, DEFAULT_SURVEY_SORT);

  const [list, visibleGroups] = await Promise.all([
    (async () => {
      try {
        return await listSurveys(user, { groupIds, search: q, page, sort });
      } catch (error) {
        if (error instanceof NotFoundError) notFound();
        throw error;
      }
    })(),
    db.group.findMany({
      where: visibleGroupsWhere(user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, path: true },
    }),
  ]);

  const { surveys, totals } = list;
  const canCreate = canEditSurvey(user, user.groupId);
  const isFiltered = Boolean(groupIds || q);
  const th = (key: SurveySortKey, label: string) => (
    <SortableTh
      label={label}
      href={sortHref("/dashboard/survei", params, key, sort, DEFAULT_SURVEY_SORT, key === "dibuat" || key === "respons" ? "desc" : "asc")}
      dir={sort.key === key ? sort.dir : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Survei"
        meta={<MetaItem icon={Network}>Data dalam cakupan Anda</MetaItem>}
        actions={
          canCreate ? (
            <Link href="/dashboard/survei/baru" className={cn(buttonVariants({ size: "lg" }), "h-11 w-full text-base sm:w-auto xl:h-9 xl:text-sm")}>
              <Plus />
              Buat survei
            </Link>
          ) : undefined
        }
      />

      <StatTiles>
        <StatTile icon={ClipboardList} label="Total survei" value={totals.surveys} />
        <StatTile icon={FilePenLine} label="Dimiliki grup saya" value={totals.owned} hint="Bisa Anda ubah jika ADMIN" />
        <StatTile icon={Inbox} label="Diwarisi dari atas" value={totals.inherited} />
        <StatTile icon={Users} label="Total respons" value={totals.responses} hint="Dalam cakupan Anda" />
      </StatTiles>

      <TableCard
        title={
          <span>
            <span className="font-medium text-foreground">{list.total}</span> survei
          </span>
        }
        toolbar={
          <FilterBar
            action="/dashboard/survei"
            isFiltered={isFiltered}
            resetHref="/dashboard/survei"
          >
            <SearchFilter value={q} placeholder="Cari survei…" />
            <GroupFilter
              groups={visibleGroups}
              selected={groupIds ?? [user.groupId]}
              active={Boolean(groupIds)}
              withDescendantsAction
              hint="Menampilkan survei yang berlaku untuk grup terpilih, termasuk dari grup induknya."
            />
            <SortSelect
              options={[
                { key: "judul", label: "Judul" },
                { key: "grup", label: "Grup pemilik" },
                { key: "respons", label: "Respons" },
                { key: "dibuat", label: "Dibuat" },
              ]}
              current={sort}
              fallback={DEFAULT_SURVEY_SORT}
            />
          </FilterBar>
        }
        footer={
          list.total > list.pageSize ? (
            <Pagination
              page={list.page}
              pageSize={list.pageSize}
              total={list.total}
              hrefFor={(target) => pageHref("/dashboard/survei", params, target)}
            />
          ) : undefined
        }
      >
        {surveys.length > 0 ? (
          <div className="relative overflow-x-auto">
            <table className={cn(tableClass, "block md:table")}>
              <thead className="hidden md:table-header-group">
                <tr className={theadRowClass}>
                  {th("judul", "Judul")}
                  {th("grup", "Grup pemilik")}
                  {th("respons", "Respons")}
                  {th("dibuat", "Dibuat")}
                  <th scope="col" className={cn(thClass, "w-12")}>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {surveys.map((survey) => {
                  const actions: RowAction[] = [
                    { label: "Lihat hasil", href: `/dashboard/survei/${survey.id}`, icon: <Eye /> },
                    { label: "Isi survei", href: `/dashboard/survei/${survey.id}/isi`, icon: <ClipboardPenLine /> },
                    { label: "Responden", href: `/dashboard/survei/${survey.id}?tab=responden`, icon: <Users /> },
                  ];
                  if (canEditSurvey(user, survey.group.id)) {
                    actions.push({ label: "Ubah formulir", href: `/dashboard/survei/${survey.id}?tab=formulir`, icon: <FilePenLine /> });
                  }
                  return (
                    <tr
                      key={survey.id}
                      className={cn(trClass, "grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-4 py-3 md:table-row md:p-0")}
                    >
                      <td className={cn(tdClass, "block min-w-0 p-0 whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap")}>
                        <Link
                          href={`/dashboard/survei/${survey.id}`}
                          className="inline-flex min-h-11 items-center font-medium hover:underline xl:min-h-0"
                        >
                          {survey.title}
                        </Link>
                        {survey.inherited && (
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            <Badge variant="secondary">Diwarisi</Badge>
                          </span>
                        )}
                      </td>
                      <td className={stackedCell}>
                        <PhoneLabel>Grup pemilik</PhoneLabel>
                        <span>{survey.group.name}</span>
                      </td>
                      <td className={cn(stackedCell, "tabular-nums")}>
                        <PhoneLabel>Respons</PhoneLabel>
                        <span>{survey.responseCount}</span>
                      </td>
                      <td className={cn(stackedCell, "tabular-nums text-muted-foreground")}>
                        <PhoneLabel>Dibuat</PhoneLabel>
                        <span>{formatDate(dateOf(survey.createdAt, user.timeZone))}</span>
                      </td>
                      <td className="col-start-2 row-start-1 p-0 text-right md:px-2 md:py-1">
                        <RowActions className="size-11 xl:size-8" label={survey.title} actions={actions} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isFiltered ? "Tidak ada survei yang cocok." : "Belum ada survei."}
          </p>
        )}
      </TableCard>
    </div>
  );
}
