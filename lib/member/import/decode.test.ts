import { describe, expect, it } from "vitest";
import { decodeCsv } from "./decode";

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("decodeCsv", () => {
  it("reads plain UTF-8 text", () => {
    expect(decodeCsv(utf8("nama\nAndré"))).toBe("nama\nAndré");
  });

  it("strips a leading UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("nama")]);
    expect(decodeCsv(bytes)).toBe("nama");
  });

  it("falls back to Windows-1252 when the bytes are not valid UTF-8", () => {
    const bytes = new Uint8Array([...utf8("Andr"), 0xe9]);
    expect(decodeCsv(bytes)).toBe("André");
  });

  it("reads Windows-1252 punctuation that Latin-1 would lose", () => {
    const bytes = new Uint8Array([0x93, ...utf8("Budi"), 0x94]);
    expect(decodeCsv(bytes)).toBe("“Budi”");
  });

  it("strips the BOM from a file that then falls back to Windows-1252", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("Andr"), 0xe9]);
    expect(decodeCsv(bytes)).toBe("André");
  });

  it("returns an empty string for an empty file", () => {
    expect(decodeCsv(new Uint8Array())).toBe("");
  });
});
