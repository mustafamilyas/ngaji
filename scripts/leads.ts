/**
 * Prints the interest leads from `/daftar`, newest first, run on the server as the app user:
 *   pnpm leads          table
 *   pnpm leads --csv    CSV with a header row (redirect it to a file)
 * Read-only: it never writes to the database. Leads hold personal data, so keep exports private.
 * See DEPLOYMENT.md.
 */
import { db } from "../lib/db";
import { formatLeadsCsv } from "../lib/interest/csv";
import { formatLeadsTable, listLeads, parseLeadsArgs } from "../lib/interest/leads";

async function main(): Promise<number> {
  const options = parseLeadsArgs(process.argv.slice(2));
  if (!options) {
    console.error("Usage: pnpm leads [--csv]");
    return 2;
  }

  const leads = await listLeads();
  if (options.csv) process.stdout.write(formatLeadsCsv(leads));
  else console.log(formatLeadsTable(leads));
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .finally(async () => {
    await db.$disconnect();
  });
