import type { EntityTagsData } from "@/lib/tag/entity";
import { TagChip } from "./tag-chip";
import { TagPicker } from "./tag-picker";

/**
 * Tag row of a detail page: chips for everyone who can see the entity, plus the picker for a user who has a
 * usable tag or may create one (an empty picker would be a dead end).
 */
export function EntityTags({ target, attached, options, canCreate }: EntityTagsData) {
  if (options.length === 0 && !canCreate) {
    if (attached.length === 0) return null;
    return (
      <ul aria-label="Tag" className="flex flex-wrap items-center gap-1.5">
        {attached.map((tag) => (
          <li key={tag.id}>
            <TagChip tag={tag} wrap />
          </li>
        ))}
      </ul>
    );
  }
  return <TagPicker target={target} attached={attached} options={options} canCreate={canCreate} />;
}
