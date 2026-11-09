/**
 * "Akhiri mulai tanggal X" (DESIGN.md §5): `endsOn = X − 1`, but when X is on or
 * before the start date there is nothing left to end, so the activity is
 * soft-deleted instead. The form warns about that case with this same check.
 * Dates are `YYYY-MM-DD`, so string comparison is date comparison; `""` means
 * no date chosen yet.
 */
export function endingDeletesActivity(startsOn: string, fromDate: string): boolean {
  return fromDate !== "" && fromDate <= startsOn;
}
