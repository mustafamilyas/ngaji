/**
 * Number of pages in a PDF, counting `/Type /Page` objects (not the `/Type /Pages` tree).
 * Enough for the PDFs Chrome writes; a general reader would parse the cross-reference table.
 */
export function countPages(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;
}
