/** True while a scrolling list has content below its visible part (a sub-pixel remainder does not count). */
export function hasMoreBelow({
  scrollHeight,
  scrollTop,
  clientHeight,
}: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return scrollHeight - scrollTop - clientHeight > 1;
}
