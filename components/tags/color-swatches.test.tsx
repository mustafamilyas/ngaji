// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";
import { TAG_COLORS } from "@/lib/constants";

import { ColorSwatches } from "./color-swatches";

describe("ColorSwatches (task 5.7)", () => {
  it("offers every palette color as a named radio and marks the selected one", () => {
    render(<ColorSwatches value="blue" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(TAG_COLORS.length);
    expect(screen.getByRole("radio", { name: "Biru" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Merah" })).not.toBeChecked();
  });

  it("calls onChange with the palette key when a swatch is chosen", async () => {
    const onChange = vi.fn();
    render(<ColorSwatches value="blue" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Merah" }));
    expect(onChange).toHaveBeenCalledWith("red");
  });

  it("gives every swatch a 44px tap target below xl", () => {
    render(<ColorSwatches value="blue" onChange={() => {}} />);
    for (const radio of screen.getAllByRole("radio")) expect(radio.className).toContain("size-11");
  });

  it("shows the selection with a check mark, not by color alone", () => {
    render(<ColorSwatches value="green" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Hijau" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Merah" }).querySelector("svg")).toBeNull();
  });

  it("names the group for screen readers", () => {
    render(<ColorSwatches value="blue" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Warna tag" })).toBeInTheDocument();
  });
});
