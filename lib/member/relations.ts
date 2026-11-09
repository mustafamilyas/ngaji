import type { RelationType, Sex } from "@/lib/validation/enums";

/**
 * Which end of a stored `MemberRelation` the viewed member is on: `from` is the
 * parent/guardian (or the smaller id for symmetric types), `to` the child/ward.
 */
export type RelationSide = "from" | "to";

const SYMMETRIC: ReadonlySet<RelationType> = new Set(["PASANGAN", "SAUDARA"]);

/** The one stored direction of a relationship: directed types keep `a → b`, symmetric ones put the smaller id first. */
export function canonicalPair(type: RelationType, a: number, b: number) {
  return SYMMETRIC.has(type) && a > b ? { fromMemberId: b, toMemberId: a } : { fromMemberId: a, toMemberId: b };
}

/** Label of the relative, by relationship type, the viewed member's side and the relative's sex. */
const LABELS: Record<RelationType, Record<RelationSide, Record<Sex, string>>> = {
  ORANG_TUA: {
    from: { L: "Anak laki-laki", P: "Anak perempuan" },
    to: { L: "Ayah", P: "Ibu" },
  },
  WALI: {
    from: { L: "Anak asuh", P: "Anak asuh" },
    to: { L: "Wali", P: "Wali" },
  },
  PASANGAN: {
    from: { L: "Suami", P: "Istri" },
    to: { L: "Suami", P: "Istri" },
  },
  SAUDARA: {
    from: { L: "Saudara laki-laki", P: "Saudara perempuan" },
    to: { L: "Saudara laki-laki", P: "Saudara perempuan" },
  },
};

export function relationLabel(type: RelationType, side: RelationSide, relativeSex: Sex): string {
  return LABELS[type][side][relativeSex];
}

/** Section of the Keluarga list: parents/guardians, spouse, siblings, children/wards. */
function sectionOf(type: RelationType, side: RelationSide): number {
  if (type === "PASANGAN") return 1;
  if (type === "SAUDARA") return 2;
  return side === "to" ? 0 : 3;
}

const collator = new Intl.Collator("id", { sensitivity: "base" });

type SortableRelative = { name: string; type: RelationType; side: RelationSide };

/** Keluarga order: by section, then by name. */
export function compareRelatives(a: SortableRelative, b: SortableRelative): number {
  return sectionOf(a.type, a.side) - sectionOf(b.type, b.side) || collator.compare(a.name, b.name);
}
