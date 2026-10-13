import { authorize } from "@/lib/authz";
import type { SessionUser } from "@/lib/auth/session-user";
import { resolveMemberView } from "@/lib/resolve";
import { newViewDefinition, parseDefinitionLenient, type Definition, type DefinitionWarning } from "@/lib/validation/member-view";
import { decodeDraft } from "./draft";

export type LoadedView = {
  /** The saved view; `null` on `/dashboard/tampilan/baru`. */
  view: Awaited<ReturnType<typeof resolveMemberView>> | null;
  /** What to render: the URL draft when it is readable, else the saved (or starting) definition. */
  definition: Definition;
  /** A readable `?d=` draft is in use (shown as "Belum disimpan"). */
  isDraft: boolean;
  /** `?d=` was present but could not be read; the saved definition is shown instead. */
  draftUnreadable: boolean;
  /** Rules/sort/columns dropped while reading the definition. */
  warnings: DefinitionWarning[];
};

/**
 * The one place a view page or its section action turns client-supplied input
 * (view id, `?d=` draft) into a definition: the view is resolved and authorized
 * for the viewer's exact group (404 otherwise), and both the saved definition
 * and the draft are read leniently. Group ids inside are checked later by
 * `prepareView`.
 */
export async function loadViewDefinition(
  session: SessionUser,
  viewId: number | null,
  draftParam?: string,
): Promise<LoadedView> {
  let view: LoadedView["view"] = null;
  let base: Definition = newViewDefinition();
  let warnings: DefinitionWarning[] = [];

  if (viewId !== null) {
    view = await resolveMemberView(session, viewId);
    authorize(session, "member_view.view", view);
    const parsed = parseDefinitionLenient(view.definition);
    base = parsed.definition;
    warnings = parsed.warnings;
  }

  if (!draftParam) return { view, definition: base, isDraft: false, draftUnreadable: false, warnings };

  const draft = decodeDraft(draftParam);
  if (!draft.ok) return { view, definition: base, isDraft: false, draftUnreadable: true, warnings };
  return { view, definition: draft.definition, isDraft: true, draftUnreadable: false, warnings: draft.warnings };
}
