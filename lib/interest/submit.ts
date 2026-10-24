import { audit } from "@/lib/audit";
import type { RequestContext } from "@/lib/auth/audit-events";
import { withKeyedLock } from "@/lib/auth/keyed-lock";
import { INTEREST_RATE_LIMIT_MAX_PER_IP, INTEREST_RATE_LIMIT_WINDOW_MINUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { whatsappNumber } from "@/lib/member/whatsapp";
import { interestSchema } from "@/lib/validation/interest";
import { interestWhatsappUrl } from "./whatsapp-text";

export type InterestResult = { whatsappUrl: string | null };

const GENERIC_INVALID = "Data tidak valid";
const RATE_LIMITED = "Terlalu banyak pendaftaran dari jaringan ini, coba lagi nanti";

/**
 * Public `/daftar` submission (interest-signup spec). Anonymous, so nothing
 * here may trust the caller: the honeypot is checked first and answered like
 * a success, then the shared zod schema runs again, then the per-IP limit.
 * The limit counts `lead.create` audit rows (the same no-extra-store idea as
 * the login limiter) and, like login, the check and the write run under one
 * keyed lock so a parallel burst cannot all pass the check first.
 *
 * The lead and its audit row belong to no organization (`groupId` and
 * `actorId` null), so no organization's audit viewer can list them; the PII
 * stays in `InterestLead`, the audit row only carries `leadId`.
 *
 * `destination` is `DAHAN_WHATSAPP`; a missing or invalid number still stores
 * the lead and just returns no link.
 */
export async function submitInterest(
  raw: unknown,
  context: RequestContext,
  destination: string | undefined,
): Promise<InterestResult> {
  if (typeof raw !== "object" || raw === null) throw new ValidationError(GENERIC_INVALID);

  const parsed = interestSchema.safeParse(raw);

  if ("website" in raw && typeof raw.website === "string" && raw.website !== "") {
    return { whatsappUrl: parsed.success ? interestWhatsappUrl(destination, parsed.data) : null };
  }
  if (!parsed.success) throw new ValidationError(GENERIC_INVALID);
  const input = parsed.data;

  // The schema already proved the number is usable.
  const phone = whatsappNumber(input.phone) as string;

  await withKeyedLock(context.ip ? [`interest-ip:${context.ip}`] : [], async () => {
    if (context.ip) {
      const since = new Date(Date.now() - INTEREST_RATE_LIMIT_WINDOW_MINUTES * 60_000);
      const recent = await db.auditLog.count({
        where: { action: "lead.create", ip: context.ip, createdAt: { gte: since } },
      });
      if (recent >= INTEREST_RATE_LIMIT_MAX_PER_IP) throw new ValidationError(RATE_LIMITED);
    }

    await db.$transaction(async (tx) => {
      const lead = await tx.interestLead.create({
        data: {
          name: input.name,
          phone,
          organizationName: input.organizationName,
          memberCount: input.memberCount ?? null,
          message: input.message ?? null,
          consentAt: new Date(),
          ip: context.ip,
          userAgent: context.userAgent,
        },
      });
      await audit(tx, {
        actorId: null,
        action: "lead.create",
        entity: "InterestLead",
        entityId: lead.id,
        meta: { leadId: lead.id },
        ip: context.ip,
        userAgent: context.userAgent,
      });
    });
  });

  return { whatsappUrl: interestWhatsappUrl(destination, input) };
}
