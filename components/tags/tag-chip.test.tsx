// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@/lib/test/dom";
import { TAG_COLORS } from "@/lib/constants";

import { TAG_CHIP_CLASS, TagChip } from "./tag-chip";

describe("TagChip (task 5.1)", () => {
  it("renders a simple tag as its key", () => {
    render(<TagChip tag={{ key: "fokus", value: null, color: "blue" }} />);
    expect(screen.getByText("fokus")).toBeInTheDocument();
  });

  it("renders a key-value tag as key:value so it is identifiable without color", () => {
    render(<TagChip tag={{ key: "prioritas", value: "tinggi", color: "red" }} />);
    expect(screen.getByText("prioritas:tinggi")).toBeInTheDocument();
  });

  it("applies the class of its palette color", () => {
    render(<TagChip tag={{ key: "fokus", value: null, color: "green" }} />);
    for (const cls of TAG_CHIP_CLASS.green.split(" ")) {
      expect(screen.getByText("fokus")).toHaveClass(cls);
    }
  });

  it("has a palette class for every TAG_COLORS entry, with a dark variant", () => {
    for (const color of TAG_COLORS) {
      expect(TAG_CHIP_CLASS[color], color).toBeTruthy();
      expect(TAG_CHIP_CLASS[color], color).toContain("dark:");
    }
  });

  it("falls back to slate for a color outside the palette", () => {
    render(<TagChip tag={{ key: "lama", value: null, color: "#ff00ff" }} />);
    for (const cls of TAG_CHIP_CLASS.slate.split(" ")) {
      expect(screen.getByText("lama")).toHaveClass(cls);
    }
  });

  it("truncates long text but keeps the full text in title", () => {
    const value = "sangat-panjang-sekali-nilai-tag-ini";
    render(<TagChip tag={{ key: "prioritas", value, color: "amber" }} />);
    const chip = screen.getByText(`prioritas:${value}`);
    expect(chip).toHaveClass("truncate");
    expect(chip).toHaveAttribute("title", `prioritas:${value}`);
  });

  it("keeps a visible border in print so the chip does not depend on color", () => {
    render(<TagChip tag={{ key: "fokus", value: null, color: "teal" }} />);
    expect(screen.getByText("fokus")).toHaveClass("print:border-black");
  });
});
