import { describe, expect, it } from "vitest";
import type { TagOwnerGroup } from "./list";
import { selectedChoice, tagChoices } from "./choices";

const tag = (id: number, groupId: number, key: string, value: string | null = null) => ({ id, groupId, key, value, color: "blue" });

const visible: TagOwnerGroup[] = [
  {
    group: { id: 3, name: "Kelompok Melati", isOwn: true },
    tags: [tag(1, 3, "fokus"), tag(2, 3, "prioritas", "tinggi"), tag(3, 3, "prioritas", "rendah")],
  },
  { group: { id: 1, name: "Desa Sukamaju", isOwn: false }, tags: [tag(5, 1, "binaan"), tag(4, 1, "prioritas", "a")] },
];

describe("tagChoices", () => {
  it("offers one entry per simple tag and per key, keeping owner order", () => {
    const choices = tagChoices(visible);
    expect(choices.map((g) => g.group.name)).toEqual(["Kelompok Melati", "Desa Sukamaju"]);
    expect(choices[0].choices).toEqual([
      { id: 1, label: "fokus", kind: "tag", color: "blue", tagIds: [1] },
      { id: 2, label: "prioritas", kind: "tagKey", color: "blue", tagIds: [2, 3] },
    ]);
  });

  it("does not merge same-named keys of different owners", () => {
    const choices = tagChoices(visible);
    expect(choices[1].choices.map((c) => [c.id, c.label, c.tagIds])).toEqual([
      [5, "binaan", [5]],
      [4, "prioritas", [4]],
    ]);
  });

  it("returns nothing when there are no tags", () => {
    expect(tagChoices([])).toEqual([]);
  });
});

describe("selectedChoice", () => {
  it("finds the entry that holds any value of the chosen key", () => {
    expect(selectedChoice(tagChoices(visible), 3)?.id).toBe(2);
  });

  it("is undefined for an id that is not offered", () => {
    expect(selectedChoice(tagChoices(visible), 99)).toBeUndefined();
    expect(selectedChoice(tagChoices(visible), undefined)).toBeUndefined();
  });
});
