/**
 * Creates an organization with its levels, root group and first OWNER, on an
 * empty database or alongside other organizations. Unlike `prisma/seed.ts`
 * (fake data, local development only) this is safe against a real database.
 * `pnpm bootstrap` is an alias of this script. See DEPLOYMENT.md.
 *
 * Configured through environment variables so it runs non-interactively:
 *   BOOTSTRAP_ORG_NAME        (required)
 *   BOOTSTRAP_ROOT_GROUP_NAME (required)
 *   BOOTSTRAP_LEVEL_NAMES     (optional, comma-separated, default "pusat,daerah,desa,kelompok")
 *   BOOTSTRAP_TIMEZONE        (optional, Asia/Jakarta | Asia/Makassar | Asia/Jayapura, default Asia/Jakarta)
 *   BOOTSTRAP_OWNER_USERNAME  (required)
 *   BOOTSTRAP_OWNER_NAME      (required)
 *   BOOTSTRAP_OWNER_PASSWORD  (required, >= 8 chars) — set by the deployer, never generated or printed
 *   BOOTSTRAP_MEMBER_CODE_PREFIX (required, 2–4 letters A–Z, unique across organizations, permanent)
 */
import { db } from "../lib/db";
import { ValidationError } from "../lib/errors";
import { provisionInputFromEnv } from "../lib/organization/from-env";
import { provisionOrganization } from "../lib/organization/provision";

async function main(): Promise<number> {
  try {
    const input = provisionInputFromEnv(process.env);
    await db.$transaction((tx) => provisionOrganization(tx, input));
    console.log(
      `Organization "${input.organizationName}" created with owner "${input.ownerUsername}" (must change password on first login).`,
    );
    return 0;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`org:create aborted: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .finally(async () => {
    await db.$disconnect();
  });
