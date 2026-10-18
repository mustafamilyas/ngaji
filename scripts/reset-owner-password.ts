/**
 * Emergency OWNER password reset, run on the server as the app user:
 *   pnpm reset-owner-password <username> [--activate]
 * Prints the temporary password once. Exits non-zero (changing nothing) for
 * an unknown username or a non-OWNER account. See DEPLOYMENT.md.
 */
import { ValidationError } from "../lib/errors";
import { resetOwnerPassword } from "../lib/user/recovery";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const activate = args.includes("--activate");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const unknownFlags = args.filter((arg) => arg.startsWith("--") && arg !== "--activate");

  if (positional.length !== 1 || unknownFlags.length > 0) {
    console.error("Usage: pnpm reset-owner-password <username> [--activate]");
    return 2;
  }

  try {
    const { temporaryPassword } = await resetOwnerPassword(positional[0], { activate });
    console.log(`Temporary password for "${positional[0]}" (shown once, must be changed at next login):`);
    console.log(temporaryPassword);
    return 0;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

main().then((code) => process.exit(code));
