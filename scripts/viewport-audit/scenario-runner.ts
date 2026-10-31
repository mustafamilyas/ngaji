import type { Cdp } from "./cdp";
import { sleep } from "./cdp";
import { evaluate, type Finding, type Measurement } from "./findings";
import type { Scenario, Step, Target } from "./scenarios";
import type { Viewport } from "./pages";

const SETTLE_AFTER_LOAD_MS = 800;
const SETTLE_AFTER_STEP_MS = 500;

/** Page script: the centre of the first visible element matching the target, scrolled into view; null if none. */
export const locateExpression = ({ selector, text }: Target) => `(() => {
  const text = ${JSON.stringify(text ?? "")};
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest('[inert], [aria-hidden="true"]');
  };
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(
    (e) => visible(e) && (!text || (e.textContent || "").trim().includes(text)),
  );
  if (!el) return null;
  // A checkbox is tapped through its label, like the collector measures it.
  const target = ((el.getAttribute("role") === "checkbox" || (el.tagName === "INPUT" && el.type === "checkbox")) && el.closest("label")) || el;
  target.scrollIntoView({ block: "center", inline: "center" });
  const r = target.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;

const describe = (target: Target) => (target.text ? `${target.selector} containing "${target.text}"` : target.selector);

/**
 * Runs every scenario at every viewport on a fresh load: the measurements after each `measure` point become
 * findings, and a step whose element is missing is itself a finding (a broken flow must not pass silently).
 */
export async function runScenario(
  cdp: Cdp,
  baseUrl: string,
  scenario: Scenario,
  viewports: Viewport[],
  collector: string,
): Promise<{ findings: Finding[]; measured: number }> {
  const findings: Finding[] = [];
  let measured = 0;

  for (const viewport of viewports) {
    const viewportLabel = `${viewport.width}x${viewport.height}`;
    await cdp.setViewport(viewport.width, viewport.height);
    const status = await cdp.navigate(`${baseUrl}${scenario.path}`);
    if (status >= 400) {
      findings.push({ kind: "flow", page: scenario.name, viewport: viewportLabel, detail: `${scenario.path} returned HTTP ${status}` });
      continue;
    }
    await sleep(SETTLE_AFTER_LOAD_MS);

    const measure = async (state: string) => {
      const measurement = await cdp.evaluate<Measurement>(collector);
      measured += measurement.items.length;
      findings.push(...evaluate(measurement, { page: `${scenario.name} › ${state}`, viewport: viewportLabel }));
    };

    for (const step of scenario.steps) {
      if ("click" in step) {
        const point = await cdp.evaluate<{ x: number; y: number } | null>(locateExpression(step.click));
        if (!point) {
          findings.push({ kind: "flow", page: scenario.name, viewport: viewportLabel, detail: `nothing to click: ${describe(step.click)}` });
          break;
        }
        await cdp.clickAt(point.x, point.y);
        await sleep(SETTLE_AFTER_STEP_MS);
      } else if ("key" in step) {
        await cdp.pressKey(step.key);
        await sleep(SETTLE_AFTER_STEP_MS);
      }
      const state = (step as Step & { measure?: string }).measure;
      if (state) await measure(state);
    }
  }
  return { findings, measured };
}
