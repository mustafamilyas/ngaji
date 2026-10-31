import type { TagSummary } from "@/lib/tag/include";
import type { TagOptionsData } from "@/lib/tag/entity";
import { BulkSelectionProvider } from "./bulk-selection";
import { TagOptionsProvider } from "./tag-options-context";

/**
 * Context of the member list's tag features: the shared picker options and, when bulk tagging is on, the
 * selection of the current page. Remounted per set of member ids (`key`), so a new page, filter or sort starts
 * with nothing selected.
 */
export function MemberTagProviders({
  options,
  canCreate,
  bulk,
  children,
}: TagOptionsData & {
  bulk: { memberIds: number[]; memberTags: Record<number, TagSummary[]> } | null;
  children: React.ReactNode;
}) {
  return (
    <TagOptionsProvider options={options} canCreate={canCreate}>
      {bulk ? (
        <BulkSelectionProvider key={bulk.memberIds.join(",")} memberIds={bulk.memberIds} memberTags={bulk.memberTags}>
          {children}
        </BulkSelectionProvider>
      ) : (
        children
      )}
    </TagOptionsProvider>
  );
}
