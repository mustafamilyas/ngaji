import { describe, expect, it } from "vitest";
import { countPages } from "./pdf";

const pdf = (...objects: string[]) => Buffer.from(`%PDF-1.4\n${objects.join("\n")}\n%%EOF`);

describe("countPages", () => {
  it("counts page objects and not the page tree", () => {
    const file = pdf(
      "1 0 obj\n<< /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 1 0 R >>\nendobj",
      "4 0 obj\n<< /Type /Page /Parent 1 0 R >>\nendobj",
    );
    expect(countPages(file)).toBe(2);
  });

  it("copes with compact spacing", () => {
    expect(countPages(pdf("<</Type/Page/Parent 1 0 R>>", "<</Type /Page /Parent 1 0 R>>"))).toBe(2);
  });

  it("is 0 for something that is not a PDF", () => {
    expect(countPages(Buffer.from("hello"))).toBe(0);
  });
});
