/** Trimmed, spaces collapsed, case ignored; shared by member and group name matching. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Name and birth date compared across members. Phone is deliberately left out. */
export function duplicateKey(name: string, birthDate: string): string {
  // Birth date is fixed-width and first, so a "|" in a name cannot make two keys collide.
  return `${birthDate}|${normalizeName(name)}`;
}

/**
 * For each row, true when it matches an existing member or an earlier row of the same file.
 * A null row (no usable name and birth date) is never marked and never matches another row.
 */
export function markDuplicates(
  rows: readonly ({ name: string; birthDate: string } | null)[],
  existingKeys: ReadonlySet<string>,
): boolean[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row) return false;
    const key = duplicateKey(row.name, row.birthDate);
    if (existingKeys.has(key) || seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}
