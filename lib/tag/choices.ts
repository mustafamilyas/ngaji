import type { TagOwnerGroup } from "./list";

/** One thing "Per tag" can break down by: a simple tag, or a whole key with all its visible values. */
export type TagChoice = {
  /** Anchor tag id sent as `?tag=` (the first value of a key). */
  id: number;
  label: string;
  kind: "tag" | "tagKey";
  color: string;
  /** Every tag id behind this choice, so any value of a key marks the key as selected. */
  tagIds: number[];
};

export type TagChoiceGroup = { group: TagOwnerGroup["group"]; choices: TagChoice[] };

/** Collapses the visible tags to one choice per simple tag / per key within each owner group. */
export function tagChoices(visible: TagOwnerGroup[]): TagChoiceGroup[] {
  return visible.map(({ group, tags }) => {
    const choices: TagChoice[] = [];
    const keys = new Map<string, TagChoice>();
    for (const tag of tags) {
      if (tag.value === null) {
        choices.push({ id: tag.id, label: tag.key, kind: "tag", color: tag.color, tagIds: [tag.id] });
        continue;
      }
      const existing = keys.get(tag.key);
      if (existing) {
        existing.tagIds.push(tag.id);
        continue;
      }
      const choice: TagChoice = { id: tag.id, label: tag.key, kind: "tagKey", color: tag.color, tagIds: [tag.id] };
      keys.set(tag.key, choice);
      choices.push(choice);
    }
    return { group, choices };
  });
}

export function selectedChoice(groups: TagChoiceGroup[], tagId: number | undefined): TagChoice | undefined {
  if (tagId === undefined) return undefined;
  return groups.flatMap((g) => g.choices).find((c) => c.tagIds.includes(tagId));
}
