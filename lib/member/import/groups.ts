import { normalizeName } from "./duplicates";

export type GroupResolution = { groupId: number } | { error: string };

/**
 * Resolves a `grup` cell against the leaf groups the caller already scoped to the user.
 * Builds the name index once, so each of up to MAX_IMPORT_ROWS cells is a single lookup.
 * Anything not in the list (out of scope, other organization, non-leaf) reads as unknown.
 */
export function createGroupResolver(leafGroups: readonly { id: number; name: string }[]) {
  const idsByName = new Map<string, number[]>();
  for (const { id, name } of leafGroups) {
    const key = normalizeName(name);
    const ids = idsByName.get(key);
    if (ids) ids.push(id);
    else idsByName.set(key, [id]);
  }

  return (cell: string): GroupResolution => {
    const key = normalizeName(cell);
    if (!key) return { error: "Wajib diisi" };
    const ids = idsByName.get(key);
    if (!ids) return { error: "Grup tidak ditemukan" };
    if (ids.length > 1) return { error: "Nama grup lebih dari satu" };
    return { groupId: ids[0] };
  };
}
