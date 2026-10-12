import { cache } from "react";
import { db } from "@/lib/db";

const FALLBACK_NAME = "Dahan";

/** Name of the deployment's single organization; one lookup per request. */
export const getOrganizationName = cache(async (): Promise<string> => {
  const organization = await db.organization.findFirst({ orderBy: { id: "asc" }, select: { name: true } });
  return organization?.name ?? FALLBACK_NAME;
});
