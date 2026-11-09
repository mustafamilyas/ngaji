import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { TAG_COLORS } from "@/lib/constants";
import { TAG_CHIP_CLASS } from "./tag-chip";

/** WCAG AA for normal-size text (chips use 12px text, so the large-text 3:1 allowance does not apply). */
const MIN_CONTRAST = 4.5;

const theme = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8");

function oklchOf(shade: string): [number, number, number] {
  const match = theme.match(new RegExp(`--color-${shade}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`));
  if (!match) throw new Error(`Tailwind theme has no color ${shade}`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
}

/** OKLCH to linear sRGB (Björn Ottosson's matrices), clipped to the gamut. */
function luminance([l, c, h]: [number, number, number]): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(oklchOf(a)), luminance(oklchOf(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The shade a class names in the given mode, e.g. `bg-red-50` -> `red-50`; dark classes carry the `dark:` prefix. */
const shadeOf = (classes: string, prefix: "bg" | "text", dark: boolean) => {
  const pattern = new RegExp(`(?:^|\\s)${dark ? "dark:" : ""}${prefix}-([a-z]+-\\d+)(?=\\s|$)`);
  const found = classes.match(pattern)?.[1];
  if (!found) throw new Error(`no ${dark ? "dark " : ""}${prefix} class in "${classes}"`);
  return found;
};

describe("tag chip palette contrast (task 7.4)", () => {
  for (const color of TAG_COLORS) {
    it(`${color}: text meets ${MIN_CONTRAST}:1 on its background in light mode`, () => {
      const classes = TAG_CHIP_CLASS[color];
      expect(contrast(shadeOf(classes, "text", false), shadeOf(classes, "bg", false))).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });

    it(`${color}: text meets ${MIN_CONTRAST}:1 on its background in dark mode`, () => {
      const classes = TAG_CHIP_CLASS[color];
      expect(contrast(shadeOf(classes, "text", true), shadeOf(classes, "bg", true))).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  }

  it("computes known ratios, so a pass is meaningful", () => {
    expect(luminance([1, 0, 0])).toBeCloseTo(1, 2);
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 2);
    // A pale text shade on the same background must fail the rule the palette is held to.
    expect(contrast("red-300", "red-50")).toBeLessThan(MIN_CONTRAST);
  });
});
