/** Entity resolved outside the caller's scope, or soft-deleted — maps to a 404 page (DESIGN.md §3.5, §4.2). */
export class NotFoundError extends Error {
  constructor(message = "Data tidak ditemukan") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** In-scope entity, but the action isn't permitted for this role — maps to a 403 (DESIGN.md §3.5). */
export class ForbiddenError extends Error {
  constructor(message = "Anda tidak memiliki izin untuk melakukan ini") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Domain-rule violation beyond what zod's schema shape can express. Message is user-facing. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Next.js redirect()/notFound() signal a control-flow jump via a thrown error carrying this digest. */
function isNextControlFlowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}

/**
 * Runs a Server Action's body, translating our typed errors into a
 * client-safe result. Anything else — a genuine bug, or a Next.js
 * redirect()/notFound() control-flow signal — is re-thrown so Next's own
 * handling (and, for real errors, its server-side stack trace log) still
 * applies; user-visible errors never carry that detail (DESIGN.md §4.4).
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof ForbiddenError ||
      error instanceof NotFoundError
    ) {
      return { ok: false, error: error.message };
    }
    if (!isNextControlFlowError(error)) {
      console.error(error);
    }
    throw error;
  }
}
