import { describe, expect, it } from "vitest";
import { tagIdsReplacedBy, type LinkedTag } from "./exclusive";

const tag = (id: number, groupId: number, key: string, value: string | null = null): LinkedTag => ({
  id,
  groupId,
  key,
  value,
});

describe("tagIdsReplacedBy", () => {
  it("replaces another value of the same key and owner", () => {
    const current = [tag(1, 10, "prioritas", "tinggi"), tag(2, 10, "fokus")];
    expect(tagIdsReplacedBy(current, tag(3, 10, "prioritas", "rendah"))).toEqual([1]);
  });

  it("replaces nothing when the entity has no value of that key", () => {
    const current = [tag(2, 10, "fokus"), tag(4, 10, "kelas", "a")];
    expect(tagIdsReplacedBy(current, tag(3, 10, "prioritas", "rendah"))).toEqual([]);
  });

  it("is a no-op when the tag is already attached", () => {
    const current = [tag(1, 10, "prioritas", "tinggi")];
    expect(tagIdsReplacedBy(current, tag(1, 10, "prioritas", "tinggi"))).toEqual([]);
  });

  it("never replaces anything for a simple tag", () => {
    const current = [tag(1, 10, "fokus"), tag(2, 10, "prioritas", "tinggi")];
    expect(tagIdsReplacedBy(current, tag(3, 10, "binaan"))).toEqual([]);
  });

  it("does not treat a simple tag with the same key text as a value", () => {
    // Owner-level rule forbids this pair, but exclusivity must still only target values.
    const current = [tag(1, 10, "prioritas")];
    expect(tagIdsReplacedBy(current, tag(2, 10, "prioritas", "tinggi"))).toEqual([]);
  });

  it("keeps same-named keys from sibling owners apart", () => {
    const current = [tag(1, 20, "prioritas", "tinggi")];
    expect(tagIdsReplacedBy(current, tag(2, 30, "prioritas", "rendah"))).toEqual([]);
  });

  it("replaces every other value of the same (owner, key)", () => {
    const current = [tag(1, 10, "prioritas", "tinggi"), tag(2, 10, "prioritas", "sedang")];
    expect(tagIdsReplacedBy(current, tag(3, 10, "prioritas", "rendah")).sort()).toEqual([1, 2]);
  });
});
