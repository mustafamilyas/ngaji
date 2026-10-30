import { describe, expect, it } from "vitest";
import { TAG_COLORS, TAG_MAX_PART_LENGTH } from "@/lib/constants";
import { createTagSchema, parseTagInput, recolorTagSchema, tagColorSchema } from "./tag";

describe("parseTagInput", () => {
  it("reads a bare word as a simple tag", () => {
    expect(parseTagInput("fokus")).toEqual({ ok: true, key: "fokus", value: null });
  });

  it("reads `a:b` as key and value, trimmed and lowercased", () => {
    expect(parseTagInput(" Prioritas : Tinggi ")).toEqual({ ok: true, key: "prioritas", value: "tinggi" });
  });

  it("collapses runs of inner spaces to one", () => {
    expect(parseTagInput("kader   baru")).toEqual({ ok: true, key: "kader baru", value: null });
    expect(parseTagInput("a  b : c   d")).toEqual({ ok: true, key: "a b", value: "c d" });
  });

  it("allows digits, hyphen and underscore", () => {
    expect(parseTagInput("kelas-1_a:2025")).toEqual({ ok: true, key: "kelas-1_a", value: "2025" });
  });

  it("accepts a part of exactly the maximum length", () => {
    const part = "a".repeat(TAG_MAX_PART_LENGTH);
    expect(parseTagInput(`${part}:${part}`)).toEqual({ ok: true, key: part, value: part });
  });

  it("rejects a part longer than the maximum", () => {
    const tooLong = "a".repeat(TAG_MAX_PART_LENGTH + 1);
    expect(parseTagInput(tooLong).ok).toBe(false);
    expect(parseTagInput(`k:${tooLong}`).ok).toBe(false);
  });

  it.each(["", "   ", ":", "a:", ":b", " : ", "a: "])("rejects empty key or value: %j", (input) => {
    expect(parseTagInput(input).ok).toBe(false);
  });

  it("rejects more than one colon", () => {
    expect(parseTagInput("a:b:c").ok).toBe(false);
  });

  it.each(["a/b", "a.b", "a,b", "a#b", "tag!", "<b>", "emoji😀", "ustazah é"])(
    "rejects characters outside letters, digits, space, - and _: %j",
    (input) => {
      expect(parseTagInput(input).ok).toBe(false);
    },
  );

  it("returns a validation message when rejecting", () => {
    const result = parseTagInput("a:b:c");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe("tagColorSchema", () => {
  it.each(TAG_COLORS)("accepts palette color %s", (color) => {
    expect(tagColorSchema.safeParse(color).success).toBe(true);
  });

  it.each(["#ff00ff", "magenta", "", "RED"])("rejects a color outside the palette: %j", (color) => {
    expect(tagColorSchema.safeParse(color).success).toBe(false);
  });
});

describe("createTagSchema", () => {
  it("parses the input into key, value and color", () => {
    const result = createTagSchema.parse({ input: " Prioritas : Tinggi ", color: "red" });
    expect(result).toEqual({ key: "prioritas", value: "tinggi", color: "red" });
  });

  it("reports the name error on the `input` field", () => {
    const result = createTagSchema.safeParse({ input: "a:b:c", color: "red" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["input"]);
  });

  it("rejects a color outside the palette", () => {
    expect(createTagSchema.safeParse({ input: "fokus", color: "#ff00ff" }).success).toBe(false);
  });
});

describe("recolorTagSchema", () => {
  it("coerces the id and checks the palette", () => {
    expect(recolorTagSchema.parse({ tagId: "7", color: "teal" })).toEqual({ tagId: 7, color: "teal" });
    expect(recolorTagSchema.safeParse({ tagId: 7, color: "nope" }).success).toBe(false);
  });
});
