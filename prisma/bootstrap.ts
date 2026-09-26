/**
 * Production bootstrap: creates the organization, its levels, a root group,
 * and exactly one OWNER user — nothing else. Unlike `prisma/seed.ts` (fake
 * org, fake members/activities, for local development only), this is safe
 * to run once against a real production database. See DEPLOYMENT.md.
 *
 * Configured entirely through environment variables so it can run
 * non-interactively during a deploy:
 *   BOOTSTRAP_ORG_NAME        (required)
 *   BOOTSTRAP_ROOT_GROUP_NAME (required) — e.g. the organization's own name
 *   BOOTSTRAP_LEVEL_NAMES     (optional, comma-separated, default "pusat,daerah,desa,kelompok")
 *   BOOTSTRAP_OWNER_USERNAME  (required)
 *   BOOTSTRAP_OWNER_PASSWORD  (required, >= 8 chars) — set by the deployer, never generated or logged
 *   BOOTSTRAP_OWNER_NAME      (required)
 */
import bcrypt from "bcrypt";
import { db } from "../lib/db";
import { BCRYPT_COST } from "../lib/constants";
import { passwordSchema } from "../lib/validation/auth";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Bootstrap aborted: environment variable ${name} is required.`);
  }
  return value;
}

async function main() {
  const existingUser = await db.user.findFirst();
  if (existingUser) {
    throw new Error(
      "Bootstrap aborted: at least one User already exists. This script only runs against an empty database.",
    );
  }

  const orgName = requireEnv("BOOTSTRAP_ORG_NAME");
  const rootGroupName = requireEnv("BOOTSTRAP_ROOT_GROUP_NAME");
  const levelNames = (process.env.BOOTSTRAP_LEVEL_NAMES ?? "pusat,daerah,desa,kelompok")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (levelNames.length === 0) {
    throw new Error("Bootstrap aborted: BOOTSTRAP_LEVEL_NAMES resolved to zero levels.");
  }

  const ownerUsername = requireEnv("BOOTSTRAP_OWNER_USERNAME");
  const ownerName = requireEnv("BOOTSTRAP_OWNER_NAME");
  const ownerPassword = requireEnv("BOOTSTRAP_OWNER_PASSWORD");
  const passwordCheck = passwordSchema.safeParse(ownerPassword);
  if (!passwordCheck.success) {
    throw new Error(`Bootstrap aborted: BOOTSTRAP_OWNER_PASSWORD ${passwordCheck.error.issues[0].message}.`);
  }
  if (!/^[a-z0-9_.]+$/i.test(ownerUsername) || ownerUsername.length < 3) {
    throw new Error(
      "Bootstrap aborted: BOOTSTRAP_OWNER_USERNAME must be at least 3 characters, letters/digits/./_ only.",
    );
  }

  const organization = await db.organization.create({ data: { name: orgName } });

  for (const [depth, name] of levelNames.entries()) {
    await db.level.create({ data: { organizationId: organization.id, depth, name } });
  }

  const rootGroup = await db.group.create({
    data: { organizationId: organization.id, parentId: null, depth: 0, name: rootGroupName, path: "" },
  });
  await db.group.update({ where: { id: rootGroup.id }, data: { path: `${rootGroup.id}/` } });

  const passwordHash = await bcrypt.hash(ownerPassword, BCRYPT_COST);
  const owner = await db.user.create({
    data: { username: ownerUsername, passwordHash, name: ownerName, mustChangePassword: true },
  });
  await db.userGroupRole.create({ data: { userId: owner.id, groupId: rootGroup.id, role: "OWNER" } });

  console.log(
    `Bootstrap complete: organization "${orgName}", ${levelNames.length} levels, root group "${rootGroupName}", owner "${ownerUsername}" (must change password on first login).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
