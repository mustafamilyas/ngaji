import { ValidationError } from "@/lib/errors";
import type { ProvisionOrganizationInput } from "@/lib/validation/organization";

const DEFAULT_LEVEL_NAMES = "pusat,daerah,desa,kelompok";

type Env = Record<string, string | undefined>;

/** Unvalidated: the timezone is still a free string until the provisioning schema checks it. */
export type RawProvisionInput = Omit<ProvisionOrganizationInput, "timezone"> & { timezone?: string };

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ValidationError(`Environment variable ${name} is required`);
  return value;
}

/**
 * Reads the `BOOTSTRAP_*` variables (DEPLOYMENT.md) into the input of
 * `provisionOrganization`. Only presence is checked here; the values are
 * validated by the provisioning schema. Errors name the variable, never its value.
 */
export function provisionInputFromEnv(env: Env): RawProvisionInput {
  return {
    organizationName: required(env, "BOOTSTRAP_ORG_NAME"),
    rootGroupName: required(env, "BOOTSTRAP_ROOT_GROUP_NAME"),
    levelNames: (env.BOOTSTRAP_LEVEL_NAMES?.trim() || DEFAULT_LEVEL_NAMES)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
    timezone: env.BOOTSTRAP_TIMEZONE?.trim() || undefined,
    ownerUsername: required(env, "BOOTSTRAP_OWNER_USERNAME"),
    ownerName: required(env, "BOOTSTRAP_OWNER_NAME"),
    ownerPassword: required(env, "BOOTSTRAP_OWNER_PASSWORD"),
  };
}
