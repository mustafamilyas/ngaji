export const ROLES = ["owner", "admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export type Options = {
  roles: Role[];
  /** Also run the two landscape-phone sizes. */
  landscape: boolean;
  /** Only audit pages whose path contains this text. */
  only: string | null;
  /** Leave the scratch dev server and database running afterwards (printed paths). */
  keepServer: boolean;
};

/** Returns null for anything unknown, so the caller prints usage. */
export function parseArgs(argv: string[]): Options | null {
  const options: Options = { roles: ["owner"], landscape: false, only: null, keepServer: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--landscape") options.landscape = true;
    else if (arg === "--keep-server") options.keepServer = true;
    else if (arg === "--roles" || arg === "--only") {
      const value = argv[++i];
      if (!value) return null;
      if (arg === "--only") options.only = value;
      else {
        const roles = value.split(",") as Role[];
        if (!roles.every((r) => (ROLES as readonly string[]).includes(r))) return null;
        options.roles = roles;
      }
    } else return null;
  }
  return options;
}
