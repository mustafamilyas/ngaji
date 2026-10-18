import { auditLoginAttempt, type RequestContext } from "./audit-events";
import { verifyCredentials, type CredentialsResult } from "./credentials";
import { withKeyedLock } from "./keyed-lock";
import { isLoginRateLimited } from "./rate-limit";
import { credentialsSchema } from "@/lib/validation/auth";

/**
 * The whole login attempt: normalize, rate-limit, verify, audit. The username
 * is parsed (trimmed) once and that value drives the limiter, the lookup and
 * the audit row, so `"budi "` and `"budi"` share one counter. Attempts for
 * the same username or IP run one after another, so a parallel burst cannot
 * all pass the limit check before their failures are recorded. A refused
 * attempt never compares the password.
 */
export async function attemptLogin(raw: unknown, context: RequestContext): Promise<CredentialsResult> {
  const parsed = credentialsSchema.safeParse(raw);
  const username = parsed.success ? parsed.data.username : null;
  const keys = [...(username ? [`u:${username}`] : []), ...(context.ip ? [`ip:${context.ip}`] : [])];

  return withKeyedLock(keys, async () => {
    if (await isLoginRateLimited(username, context.ip)) {
      const refused: CredentialsResult = {
        ok: false,
        reason: "rate_limited",
        actorId: null,
        username,
      };
      await auditLoginAttempt(refused, context);
      return refused;
    }

    const result = await verifyCredentials(parsed.success ? parsed.data : raw);
    await auditLoginAttempt(result, context);
    return result;
  });
}
