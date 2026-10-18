import { describe, expect, it } from "vitest";
import { getClientIp } from "./http";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/login", { headers });
}

describe("getClientIp", () => {
  it("returns the single X-Forwarded-For entry", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("takes the last hop of a multi-hop header", () => {
    expect(getClientIp(req({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("ignores a spoofed first hop", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("trims whitespace around the last hop", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4,   203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP when X-Forwarded-For is absent", () => {
    expect(getClientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to X-Real-IP when X-Forwarded-For is empty", () => {
    expect(getClientIp(req({ "x-forwarded-for": " , ", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers X-Forwarded-For over X-Real-IP", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.7");
  });

  it("returns null when neither header is present", () => {
    expect(getClientIp(req({}))).toBeNull();
  });
});
