/**
 * One-off after the member-code migration, run on the server before the app starts (DEPLOYMENT.md):
 *   pnpm member-codes:backfill <organizationId>=<PREFIX> ...
 * Sets missing organization prefixes (2–4 letters A–Z, permanent) and gives every member without a
 * code one, soft-deleted members included. Refuses, changing nothing, if any organization would be
 * left without a prefix or an existing prefix would change. Idempotent: a second run changes nothing.
 */
import { db } from "../lib/db";
import { ValidationError } from "../lib/errors";
import { backfillMemberCodes, parseBackfillArgs } from "../lib/member/code-backfill";

const USAGE = "Usage: pnpm member-codes:backfill <organizationId>=<PREFIX> ...";

async function main(): Promise<number> {
  let requested: Map<number, string>;
  try {
    requested = parseBackfillArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  try {
    for (const result of await backfillMemberCodes(requested)) {
      const prefix = result.prefixSet ? `prefix ${result.prefix} set` : `prefix ${result.prefix}`;
      console.log(`Organization ${result.organizationId} (${result.name}): ${prefix}, ${result.codes} member codes assigned`);
    }
    return 0;
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    console.error(`member-codes:backfill aborted, nothing changed: ${error.message}`);
    return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .finally(async () => {
    await db.$disconnect();
  });
