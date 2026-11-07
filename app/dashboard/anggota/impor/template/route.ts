import { requireSession } from "@/lib/auth/require-session";
import { ForbiddenError } from "@/lib/errors";
import { importTemplateCsv } from "@/lib/member/import/template";

/** The CSV template for member import. Needs a session, like every other dashboard page. */
export async function GET(): Promise<Response> {
  try {
    await requireSession();
  } catch (error) {
    // A pending password change answers 403; a missing session redirects to login inside requireSession.
    if (error instanceof ForbiddenError) return new Response(null, { status: 403 });
    throw error;
  }

  return new Response(importTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="template-anggota.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
