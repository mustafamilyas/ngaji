import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  const directives = (csp: string) => csp.split("; ");

  it("locks down base, object and form targets", () => {
    const csp = directives(buildCsp("abc", { dev: false }));
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("carries the per-request nonce", () => {
    expect(buildCsp("abc", { dev: false })).toContain("'nonce-abc'");
  });

  it("allows unsafe-eval only in development", () => {
    expect(buildCsp("abc", { dev: true })).toContain("'unsafe-eval'");
    expect(buildCsp("abc", { dev: false })).not.toContain("'unsafe-eval'");
  });
});
