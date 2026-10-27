export const DEFAULT_PORT = 3100;

export type Options = {
  port: number;
  /** Keep the scratch database after the server stops. */
  keep: boolean;
};

/** Returns null for anything unknown, so the caller prints usage. */
export function parseArgs(argv: string[]): Options | null {
  const options: Options = { port: DEFAULT_PORT, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--keep") options.keep = true;
    else if (arg === "--port") {
      const value = argv[++i];
      if (value === undefined || !/^\d+$/.test(value)) return null;
      const port = Number(value);
      if (port < 1024 || port > 65535) return null;
      options.port = port;
    } else return null;
  }
  return options;
}
