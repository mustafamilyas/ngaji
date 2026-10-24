"use server";

import { headers } from "next/headers";
import { type ActionResult, runAction } from "@/lib/errors";
import { getClientIp } from "@/lib/http";
import { type InterestResult, submitInterest } from "@/lib/interest/submit";

/**
 * Public (no session): the only trusted inputs are the request headers and
 * `DAHAN_WHATSAPP`, both read here on the server. Everything in `raw` is
 * re-validated by `submitInterest`.
 */
export async function submitInterestAction(raw: unknown): Promise<ActionResult<InterestResult>> {
  const requestHeaders = await headers();
  return runAction(() =>
    submitInterest(
      raw,
      { ip: getClientIp({ headers: requestHeaders }), userAgent: requestHeaders.get("user-agent") },
      process.env.DAHAN_WHATSAPP,
    ),
  );
}
