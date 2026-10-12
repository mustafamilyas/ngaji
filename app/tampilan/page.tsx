import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { dateOf } from "@/lib/dates";
import { formatDate, parsePage, parseSearch } from "@/lib/filters";
import { listMemberViews } from "@/lib/member-view/list";
import { pageHref } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export default async function MemberViewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const q = parseSearch(params.q);
  const page = parsePage(params.page);

  const { views, total, page: currentPage, pageSize } = await listMemberViews(session.user, { search: q, page });
  const isFiltered = Boolean(q);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tampilan"
        meta="Daftar anggota tersimpan milik grup Anda. Hasilnya tetap dibatasi scope Anda."
        actions={
          <Link href="/tampilan/baru" className={buttonVariants({ size: "lg" })}>
            <Plus />
            Buat tampilan
          </Link>
        }
      />

      <TableCard
        title={
          <>
            {isFiltered ? "Hasil pencarian" : "Semua tampilan"}:{" "}
            <span className="font-medium text-foreground">{total} tampilan</span>
          </>
        }
        toolbar={
          <FilterBar action="/tampilan" isFiltered={isFiltered} resetHref="/tampilan">
            <SearchFilter value={q} placeholder="Cari nama tampilan…" />
          </FilterBar>
        }
        footer={
          total > pageSize ? (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              hrefFor={(target) => pageHref("/tampilan", params, target)}
            />
          ) : undefined
        }
      >
        {views.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  <th scope="col" className={thClass}>Nama</th>
                  <th scope="col" className={thClass}>Pemilik</th>
                  <th scope="col" className={thClass}>Diperbarui</th>
                </tr>
              </thead>
              <tbody>
                {views.map((view) => (
                  <tr key={view.id} className={trClass}>
                    <th scope="row" className={cn(tdClass, "text-left font-medium")}>
                      <Link href={`/tampilan/${view.id}`} className="hover:underline">
                        {view.name}
                      </Link>
                    </th>
                    <td className={tdClass}>
                      <span className="flex items-center gap-2">
                        {view.ownerName}
                        {view.orphaned && <Badge variant="secondary">Tanpa pemilik</Badge>}
                      </span>
                    </td>
                    <td className={cn(tdClass, "text-muted-foreground")}>{formatDate(dateOf(view.updatedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isFiltered ? "Tidak ada tampilan yang cocok." : "Belum ada tampilan."}
          </p>
        )}
      </TableCard>
    </div>
  );
}
