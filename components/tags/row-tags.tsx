import type { TagSummary } from "@/lib/tag/include";
import type { TagTarget } from "@/lib/validation/tag";
import { TagChip } from "./tag-chip";
import { TagPicker } from "./tag-picker";

/**
 * Tags of one table row: read-only chips, plus a compact "+" picker when the page offers one (`canPick`, with a
 * `TagOptionsProvider` above the table). Chips wrap, so a long list grows the row instead of the page's width.
 */
export function RowTags({
  target,
  attached,
  canPick,
  label,
}: {
  target: TagTarget;
  attached: TagSummary[];
  canPick: boolean;
  label: string;
}) {
  if (canPick) return <TagPicker target={target} attached={attached} compact label={label} />;
  if (attached.length === 0) return null;
  return (
    <ul aria-label="Tag" className="flex flex-wrap items-center gap-1">
      {attached.map((tag) => (
        <li key={tag.id}>
          <TagChip tag={tag} />
        </li>
      ))}
    </ul>
  );
}
