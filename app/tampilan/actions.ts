"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { VIEW_MAX_DRAFT_LENGTH } from "@/lib/constants";
import { type ActionResult, NotFoundError, ValidationError, runAction } from "@/lib/errors";
import { loadViewDefinition } from "@/lib/member-view/load";
import { loadSectionMembers } from "@/lib/member-view/sections";

const loadSectionSchema = z.object({
  viewId: z.number().int().positive().nullable(),
  draft: z.string().max(VIEW_MAX_DRAFT_LENGTH).optional(),
  key: z.string().min(1).max(40),
  offset: z.number().int().min(0).max(1_000_000),
});

/**
 * "Tampilkan lebih banyak" / first expand of a collapsed section. Nothing the
 * client sends is trusted: the view is re-resolved and authorized, the draft is
 * re-validated, and the section is re-derived from the definition and `key`.
 */
export async function loadSectionAction(input: unknown) {
  const session = await requireSession();
  return runAction(async () => {
    const parsed = loadSectionSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Data tidak valid");
    const { viewId, draft, key, offset } = parsed.data;

    const loaded = await loadViewDefinition(session, viewId, draft);
    const result = await loadSectionMembers(session, loaded.definition, key, offset);
    if (!result) throw new NotFoundError();
    return { members: result.members, hasMore: result.hasMore };
  });
}

export type LoadSectionResult = Awaited<ReturnType<typeof loadSectionAction>> extends ActionResult<infer T> ? T : never;
