import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";

import { StatTile } from "./data-table";

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

const html = renderToStaticMarkup(
  <StatTile icon={Users} label="Bergabung bulan ini" value={12} hint="Keluar, pindah, meninggal" />,
);

describe("StatTile on phones (task 3.1)", () => {
  it("uses tighter padding and a smaller value below lg, and today's sizes from lg", () => {
    expect(classOf(html, /<div[^>]*>/)).toMatch(/\bp-3\b.*\blg:p-4\b/);
    expect(classOf(html, /<p[^>]*>12<\/p>/)).toMatch(/\btext-xl\b.*\blg:text-2xl\b/);
  });

  it("keeps the label on one line below lg, with the full text in a title", () => {
    expect(classOf(html, /<span[^>]*>Bergabung bulan ini<\/span>/)).toMatch(/\btruncate\b.*\blg:whitespace-normal\b/);
    expect(html).toContain('title="Bergabung bulan ini"');
  });

  it("hides the hint below lg", () => {
    expect(classOf(html, /<p[^>]*>Keluar, pindah, meninggal<\/p>/)).toMatch(/\bhidden\b.*\blg:block\b/);
  });
});
