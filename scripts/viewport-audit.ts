/**
 * Mobile and tablet audit: walks every page at phone and tablet sizes in a headless Chrome and reports
 *   - page-level horizontal overflow
 *   - tap targets under 44px tall
 *   - text fields under 16px (iOS zooms on focus)
 *   - charts whose svg did not follow a resize (the pages are resized without a reload, like a rotation)
 *
 * Self-contained: builds a scratch database (migrate + seed) and a throwaway `next dev` server, so it
 * never touches prisma/dev.db. Stop any `pnpm dev` running in this folder first.
 *
 *   pnpm audit:viewport                       owner, 360x740 / 768x1024 / 1024x768
 *   pnpm audit:viewport --roles owner,admin,user
 *   pnpm audit:viewport --landscape           also 667x375 and 812x375
 *   pnpm audit:viewport --only kegiatan       pages whose path contains "kegiatan"
 *   pnpm audit:viewport --keep-server         leave the scratch server and database running
 *
 * Exit code 1 when any defect is found. Needs Google Chrome (or CHROME_PATH) and Node 22+.
 * Dialogs, popovers and open dropdowns are not covered: they need a click first.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./viewport-audit/args";
import { Cdp, sleep } from "./viewport-audit/cdp";
import { startScratchEnv } from "./viewport-audit/env";
import { login } from "./viewport-audit/login";
import { evaluate, formatReport, type Finding, type Measurement, type SkippedPage } from "./viewport-audit/findings";
import { buildPageList, viewportsFor, type Viewport } from "./viewport-audit/pages";

const SETTLE_AFTER_LOAD_MS = 800;
const SETTLE_AFTER_RESIZE_MS = 600;
const collector = readFileSync(join(__dirname, "viewport-audit", "collector.js"), "utf8");

const label = (viewport: Viewport) => `${viewport.width}x${viewport.height}`;

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.error("Usage: pnpm audit:viewport [--roles owner,admin,user] [--landscape] [--only <text>] [--keep-server]");
    return 2;
  }

  const env = await startScratchEnv();
  const profile = mkdtempSync(join(tmpdir(), "dahan-audit-chrome-"));
  const cdp = await Cdp.launch(profile);
  const viewports = viewportsFor(options.landscape);
  const findings: Finding[] = [];
  const skipped: SkippedPage[] = [];
  let controlsMeasured = 0;
  let pagesMeasured = 0;
  const pages = buildPageList(env.ids).filter((page) => !options.only || page.path.includes(options.only));

  const audit = async (path: string, role: string) => {
    const where = options.roles.length > 1 ? `${path} [${role}]` : path;
    process.stderr.write(`  ${where}\n`);
    await cdp.setViewport(viewports[0].width, viewports[0].height);
    const status = await cdp.navigate(`${env.baseUrl}${path}`);
    const landedOn = await cdp.evaluate<string>("location.pathname");
    if (status >= 400) return void skipped.push({ page: where, reason: `HTTP ${status}` });
    if (landedOn !== path.split("?")[0]) return void skipped.push({ page: where, reason: `redirected to ${landedOn}` });

    await sleep(SETTLE_AFTER_LOAD_MS);
    pagesMeasured++;
    for (const [index, viewport] of viewports.entries()) {
      if (index > 0) {
        // No reload: like rotating a phone, so observer-driven layout (charts) must follow.
        await cdp.setViewport(viewport.width, viewport.height);
        await sleep(SETTLE_AFTER_RESIZE_MS);
      }
      const measurement = await cdp.evaluate<Measurement>(collector);
      controlsMeasured += measurement.items.length;
      findings.push(...evaluate(measurement, { page: where, viewport: label(viewport) }));
    }
  };

  try {
    process.stderr.write(`Auditing ${pages.length} page(s) at ${viewports.map(label).join(", ")}\n`);
    for (const page of pages.filter((p) => p.anonymous)) {
      await cdp.send("Network.clearBrowserCookies");
      await audit(page.path, "anonymous");
    }
    for (const role of options.roles) {
      await login(cdp, env.baseUrl, role);
      for (const page of pages.filter((p) => !p.anonymous)) await audit(page.path, role);
    }
  } finally {
    // Each step on its own: a failed cleanup must not leave the dev server running.
    await cdp.close().catch(() => {});
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // A leftover temp folder is harmless.
    }
    env.stop({ keep: options.keepServer });
  }

  const reportPath = join(tmpdir(), `viewport-audit-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify({ findings, skipped }, null, 2));
  console.log(formatReport(findings, skipped));
  // A run that measured nothing must not look like a pass.
  console.error(`\nMeasured ${controlsMeasured} controls on ${pagesMeasured} page(s) (x ${viewports.length} sizes).`);
  if (controlsMeasured === 0) {
    console.error("Nothing was measured: the audit is not working.");
    return 2;
  }
  console.error(`\nJSON report: ${reportPath}`);
  return findings.length > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
