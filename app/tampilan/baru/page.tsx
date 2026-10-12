import { ViewPage } from "../view-page";

export default async function NewMemberViewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ViewPage({ viewId: null, searchParams: await searchParams });
}
