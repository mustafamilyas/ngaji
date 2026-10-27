/**
 * Print audit: prints the schedule page (`/dashboard/kegiatan/cetak`) to PDF through Chrome itself (A4 portrait,
 * print media) for a few fixed scenarios on a scratch database, writes each PDF, and fails when one takes more
 * pages than its budget. Page images (`--png`) need macOS `sips`; open the PDFs to check the look.
 *
 *   pnpm audit:print                      all scenarios, PDFs in a temp folder (its path is printed)
 *   pnpm audit:print --only week
 *   pnpm audit:print --out ./prints --png
 *   pnpm audit:print --keep-server        leave the scratch dev server and database running
 *
 * Exit code 1 when a page budget is exceeded or nothing was measured, 2 on bad arguments.
 * Needs Google Chrome (or CHROME_PATH). Stop any `pnpm dev` running in this folder first.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { today } from "@/lib/dates";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";
import { parseArgs } from "./audit-print/args";
import { countPages } from "./audit-print/pdf";
import { evaluate, formatReport, SCENARIOS, type Result } from "./audit-print/scenarios";
import { Cdp, sleep } from "./viewport-audit/cdp";
import { startScratchEnv } from "./viewport-audit/env";
import { login } from "./viewport-audit/login";

const A4 = { paperWidth: 8.27, paperHeight: 11.69 };

async function printToPdf(cdp: Cdp, pageRanges = ""): Promise<Buffer> {
  const { data } = (await cdp.send("Page.printToPDF", { ...A4, printBackground: true, pageRanges })) as { data: string };
  return Buffer.from(data, "base64");
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.error("Usage: pnpm audit:print [--only <text>] [--out <dir>] [--png] [--keep-server]");
    return 2;
  }
  const scenarios = SCENARIOS.filter((s) => !options.only || s.name.includes(options.only));
  if (scenarios.length === 0) {
    console.error(`No scenario matches "${options.only}". Scenarios: ${SCENARIOS.map((s) => s.name).join(", ")}`);
    return 2;
  }
  const out = options.out ? resolve(options.out) : mkdtempSync(join(tmpdir(), "dahan-print-"));
  mkdirSync(out, { recursive: true });
  const png = options.png && process.platform === "darwin";
  if (options.png && !png) console.error("--png needs macOS (`sips`); writing PDFs only.");

  const env = await startScratchEnv();
  const profile = mkdtempSync(join(tmpdir(), "dahan-print-chrome-"));
  const cdp = await Cdp.launch(profile);
  const results: Result[] = [];
  try {
    await cdp.setViewport(1024, 768);
    await login(cdp, env.baseUrl, "owner");
    await cdp.send("Emulation.setEmulatedMedia", { media: "print" });
    const now = today(DEFAULT_TIMEZONE);

    for (const scenario of scenarios) {
      process.stderr.write(`  ${scenario.name}\n`);
      if (scenario.prepare) {
        const db = new Database(join(env.dir, "scratch.db"));
        scenario.prepare(db);
        db.close();
      }
      const { from, to } = scenario.range(now);
      const status = await cdp.navigate(`${env.baseUrl}/dashboard/kegiatan/cetak?range=custom&from=${from}&to=${to}`);
      if (status >= 400) throw new Error(`${scenario.name}: the print page answered HTTP ${status}`);
      await sleep(800);
      const rows = await cdp.evaluate<number>("document.querySelectorAll('tbody tr').length");

      const pdf = await printToPdf(cdp);
      const file = join(out, `${scenario.name}.pdf`);
      writeFileSync(file, pdf);
      const pages = countPages(pdf);
      results.push({ name: scenario.name, description: scenario.description, rows, pages, maxPages: scenario.maxPages, file });

      if (png) {
        for (let page = 1; page <= pages; page++) {
          const single = join(out, `${scenario.name}-p${page}.pdf`);
          writeFileSync(single, await printToPdf(cdp, String(page)));
          execFileSync("sips", ["-s", "format", "png", single, "--out", join(out, `${scenario.name}-p${page}.png`)], { stdio: "ignore" });
        }
      }
    }
  } finally {
    await cdp.close();
    env.stop({ keep: options.keepServer });
  }

  console.log(`\n${formatReport(results)}\n\nPDFs: ${out}`);
  return results.some((r) => evaluate(r) !== null) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
