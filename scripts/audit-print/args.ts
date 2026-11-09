export type Options = {
  /** Only run scenarios whose name contains this text. */
  only: string | null;
  /** Folder for the PDFs (and images); a temp folder when null. */
  out: string | null;
  /** Also write one PNG per page (macOS `sips` only). */
  png: boolean;
  /** Leave the scratch dev server and database running afterwards. */
  keepServer: boolean;
};

/** Returns null for anything unknown, so the caller prints usage. */
export function parseArgs(argv: string[]): Options | null {
  const options: Options = { only: null, out: null, png: false, keepServer: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--png") options.png = true;
    else if (arg === "--keep-server") options.keepServer = true;
    else if (arg === "--only" || arg === "--out") {
      const value = argv[++i];
      if (!value) return null;
      options[arg === "--only" ? "only" : "out"] = value;
    } else return null;
  }
  return options;
}
