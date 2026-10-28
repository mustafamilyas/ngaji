import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Input } from "./input";
import { Select, SelectTrigger } from "./select";
import { Textarea } from "./textarea";

/**
 * Touch sizes live in the primitives (tasks 10.23 and 11.23): 44px tall with 16px text below `xl` (so a 1024px landscape
 * tablet keeps them, and iOS Safari does not zoom on focus), compact again from `xl`.
 */
const classOf = (html: string) => html.match(/class="([^"]*)"/)?.[1] ?? "";
const has = (cls: string, token: string) => cls.split(/\s+/).includes(token);

describe("Button", () => {
  it.each([
    ["default", "h-11", "xl:h-8"],
    ["lg", "h-11", "xl:h-9"],
    ["sm", "h-11", "xl:h-7"],
    ["icon", "size-11", "xl:size-8"],
    ["icon-sm", "size-11", "xl:size-7"],
    ["icon-lg", "size-11", "xl:size-9"],
  ] as const)("size %s is 44px below xl and compact from xl", (size, touch, compact) => {
    const cls = classOf(renderToStaticMarkup(createElement(Button, { size })));
    expect(has(cls, touch), cls).toBe(true);
    expect(has(cls, compact), cls).toBe(true);
    // no leftover fixed desktop height winning below xl
    expect(cls.split(/\s+/).filter((t) => /^(h|size)-(6|7|8|9)$/.test(t)), cls).toEqual([]);
  });

  it("uses 16px text below xl for the text sizes, 14px from xl", () => {
    for (const size of ["default", "lg", "sm"] as const) {
      const cls = classOf(renderToStaticMarkup(createElement(Button, { size })));
      expect(has(cls, "text-base"), size).toBe(true);
      expect(has(cls, "xl:text-sm") || has(cls, "xl:text-[0.8rem]"), size).toBe(true);
      expect(has(cls, "text-sm"), `${size} must not keep the base 14px`).toBe(false);
    }
  });

  it("keeps the caller's own classes on top", () => {
    const cls = classOf(renderToStaticMarkup(createElement(Button, { className: "w-full" })));
    expect(has(cls, "w-full")).toBe(true);
  });
});

describe("Input and Textarea", () => {
  it("Input is 44px with 16px text below xl, compact from xl, and never 14px at md (iPad)", () => {
    const cls = classOf(renderToStaticMarkup(createElement(Input)));
    expect(has(cls, "h-11")).toBe(true);
    expect(has(cls, "text-base")).toBe(true);
    expect(has(cls, "xl:h-8")).toBe(true);
    expect(has(cls, "xl:text-sm")).toBe(true);
    expect(has(cls, "md:text-sm")).toBe(false);
    expect(has(cls, "h-8")).toBe(false);
  });

  it("Textarea keeps 16px text until xl", () => {
    const cls = classOf(renderToStaticMarkup(createElement(Textarea)));
    expect(has(cls, "text-base")).toBe(true);
    expect(has(cls, "xl:text-sm")).toBe(true);
    expect(has(cls, "md:text-sm")).toBe(false);
  });
});

describe("Select", () => {
  it("the trigger is 44px with 16px text below xl, compact from xl", () => {
    const html = renderToStaticMarkup(createElement(Select, null, createElement(SelectTrigger, null, "x")));
    const cls = classOf(html);
    expect(has(cls, "data-[size=default]:h-11")).toBe(true);
    expect(has(cls, "xl:data-[size=default]:h-8")).toBe(true);
    expect(has(cls, "data-[size=sm]:h-11")).toBe(true);
    expect(has(cls, "xl:data-[size=sm]:h-7")).toBe(true);
    expect(has(cls, "text-base")).toBe(true);
    expect(has(cls, "xl:text-sm")).toBe(true);
    expect(has(cls, "data-[size=default]:h-8")).toBe(false);
  });

  it("the options are at least 44px tall below xl (they render in a portal, so this reads the source)", () => {
    const source = readFileSync(new URL("./select.tsx", import.meta.url), "utf8");
    const item = source.slice(source.indexOf("function SelectItem"), source.indexOf("function SelectSeparator"));
    expect(item).toMatch(/\bmin-h-11\b/);
    expect(item).toMatch(/\bxl:min-h-0\b/);
    expect(item).toMatch(/\btext-base\b/);
    expect(item).toMatch(/\bxl:text-sm\b/);
  });
});
