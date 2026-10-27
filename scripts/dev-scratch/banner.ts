/** Seeded accounts from prisma/seed.ts (test data only; the forced password change is cleared on the scratch copy). */
const LOGINS = [
  ["admin / admin", "OWNER of the first organization (root group)"],
  ["admin_desa / desa123", "ADMIN of Desa Menteng"],
  ["user_kelompok / user123", "USER of Kelompok A"],
  ["admin_annur / annur123", "OWNER of the second organization (Majelis An-Nur)"],
] as const;

export function formatBanner({ baseUrl, dbPath, keep }: { baseUrl: string; dbPath: string; keep: boolean }): string {
  const logins = LOGINS.map(([login, who]) => `    ${login.padEnd(26)} ${who}`).join("\n");
  const fate = keep
    ? `The database is kept after you stop (--keep): ${dbPath}`
    : "The database is deleted when you stop (Ctrl+C); use --keep to keep it.";
  return [
    "",
    `  Scratch Dahan dev server: ${baseUrl}`,
    "  A throwaway, freshly seeded database; prisma/dev.db is not touched.",
    "",
    "  Logins:",
    logins,
    "",
    `  ${fate}`,
    "",
  ].join("\n");
}
