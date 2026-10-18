import { notFound } from "next/navigation";
import { ViewPage } from "../view-page";

export default async function MemberViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const viewId = Number(id);
  if (!Number.isInteger(viewId) || viewId <= 0) notFound();
  return ViewPage({ viewId, searchParams: await searchParams });
}
