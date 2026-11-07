import { IMPORT_COLUMNS } from "./columns";

/**
 * The header row only, with a BOM so Excel reads it as UTF-8. Built from `columns.ts` so it cannot drift.
 * `grup` is left out: a file with that column ignores the page's group chooser and needs it filled on every row,
 * so users who want several groups add it themselves.
 */
export function importTemplateCsv(): string {
  const header = IMPORT_COLUMNS.map((column) => column.key).filter((key) => key !== "grup");
  return `﻿${header.join(",")}\r\n`;
}
