"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { type ActionResult, runAction, ValidationError } from "@/lib/errors";
import { analyzeImport, type ImportReport } from "@/lib/member/import/analyze";
import { importMembers } from "@/lib/member/mutations";
import { idSchema } from "@/lib/validation/common";

/** The file and the chosen group arrive as FormData; both are re-resolved on the server every time. */
function readForm(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ValidationError("Pilih file CSV");

  const rawGroupId = formData.get("groupId");
  let groupId: number | undefined;
  if (typeof rawGroupId === "string" && rawGroupId !== "") {
    const parsed = idSchema.safeParse(rawGroupId);
    if (!parsed.success) throw new ValidationError("Grup tidak valid");
    groupId = parsed.data;
  }
  return { file, groupId, force: formData.get("force") === "on" };
}

/** Reads and validates the file; creates nothing and stores nothing. */
export async function previewMemberImportAction(formData: FormData): Promise<ActionResult<ImportReport>> {
  const session = await requireSession();
  return runAction(async () => {
    const { file, groupId } = readForm(formData);
    const analysis = await analyzeImport(session, file, groupId);
    if (!analysis.ok) throw new ValidationError(analysis.error);
    return analysis.report;
  });
}

export type ConfirmImportResult =
  | { status: "invalid"; report: ImportReport }
  | { status: "done"; created: number; skipped: number; importId: string; groupId: number };

/** Runs the same pipeline as the preview, then writes only if every row is valid. */
export async function confirmMemberImportAction(formData: FormData): Promise<ActionResult<ConfirmImportResult>> {
  const session = await requireSession();
  const result = await runAction<ConfirmImportResult>(async () => {
    const { file, groupId, force } = readForm(formData);
    const analysis = await analyzeImport(session, file, groupId);
    if (!analysis.ok) throw new ValidationError(analysis.error);
    if (analysis.report.totalErrors > 0) return { status: "invalid", report: analysis.report };

    const rows = analysis.rows.filter((row) => force || !row.duplicate);
    if (rows.length === 0) throw new ValidationError("Tidak ada anggota baru untuk diimpor");
    const { created, importId } = await importMembers(session, rows.map((row) => row.data));
    return { status: "done", created, skipped: analysis.rows.length - rows.length, importId, groupId: rows[0].data.groupId };
  });
  if (result.ok && result.data.status === "done") {
    revalidatePath("/dashboard/anggota");
    revalidatePath(`/dashboard/grup/${result.data.groupId}`);
  }
  return result;
}
