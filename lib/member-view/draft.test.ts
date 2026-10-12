import { describe, expect, it } from "vitest";
import { VIEW_MAX_DRAFT_LENGTH } from "@/lib/constants";
import { emptyDefinition, newViewDefinition, type Definition } from "@/lib/validation/member-view";
import { decodeDraft, encodeDraft } from "./draft";

const b64url = (text: string) => Buffer.from(text).toString("base64url");

describe("draft round-trip", () => {
  it("round-trips a definition", () => {
    const def: Definition = {
      ...newViewDefinition(),
      sort: { field: "age", dir: "desc" },
      groupBy: { kind: "ageBuckets", buckets: [{ label: "Remaja", min: 13, max: 17 }] },
      columns: ["grup", "hp"],
    };
    const encoded = encodeDraft(def);
    expect(encoded).not.toBeNull();
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeDraft(encoded!)).toEqual({ ok: true, definition: def, warnings: [] });
  });

  it("keeps non-ASCII text intact", () => {
    const def: Definition = { ...emptyDefinition(), filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "name", operator: "contains", value: "Ṣāliḥ 日本" }] }] } };
    expect(decodeDraft(encodeDraft(def)!)).toMatchObject({ ok: true, definition: def });
  });

  it("matches standard base64url from Node", () => {
    const def = emptyDefinition();
    expect(encodeDraft(def)).toBe(b64url(JSON.stringify(def)));
  });
});

describe("oversize input", () => {
  it("refuses to encode a draft over the limit", () => {
    const rules = Array.from({ length: 10 }, () => ({ field: "name" as const, operator: "contains" as const, value: "x".repeat(100) }));
    const def: Definition = { ...emptyDefinition(), filter: { op: "AND", groups: Array.from({ length: 10 }, () => ({ op: "AND" as const, rules })) } };
    expect(encodeDraft(def)).toBeNull();
  });

  it("rejects an oversized value on decode", () => {
    expect(decodeDraft("a".repeat(VIEW_MAX_DRAFT_LENGTH + 1))).toEqual({ ok: false });
  });
});

describe("tampered input", () => {
  it("rejects absent, empty and non-base64url values", () => {
    for (const value of [undefined, "", "not base64!", "a+b/c=", "%%%"]) {
      expect(decodeDraft(value)).toEqual({ ok: false });
    }
  });

  it("rejects values that are not JSON or not a definition", () => {
    expect(decodeDraft(b64url("not json"))).toEqual({ ok: false });
    expect(decodeDraft(b64url("[1,2]"))).toEqual({ ok: false });
    expect(decodeDraft(b64url('{"version":2}'))).toEqual({ ok: false });
    expect(decodeDraft("AAAA")).toEqual({ ok: false });
  });

  it("rejects invalid UTF-8", () => {
    expect(decodeDraft(Buffer.from([0xff, 0xfe, 0xfd]).toString("base64url"))).toEqual({ ok: false });
  });

  it("ignores PII rules with a warning instead of failing", () => {
    const tampered = { ...emptyDefinition(), filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "phone", operator: "contains", value: "08" }] }] } };
    expect(decodeDraft(b64url(JSON.stringify(tampered)))).toEqual({ ok: true, definition: emptyDefinition(), warnings: ["rule_invalid"] });
  });
});
