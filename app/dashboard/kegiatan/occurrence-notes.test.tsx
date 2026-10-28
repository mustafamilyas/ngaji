// @vitest-environment jsdom
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/lib/test/dom";
import { OCCURRENCE_NOTES_EXPAND_FROM } from "@/lib/constants";
import { OccurrenceNotes } from "./occurrence-notes";

const long = "Mohon membawa perlengkapan masing-masing. ".repeat(3).trim();

describe("OccurrenceNotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders nothing without notes", () => {
    const { container } = render(<OccurrenceNotes notes={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a short single-line note as plain text without a toggle", () => {
    render(<OccurrenceNotes notes="Bawa Al-Quran" />);
    expect(screen.getByText("Bawa Al-Quran")).toBeInTheDocument();
    expect(document.querySelector("details")).not.toBeInTheDocument();
  });

  it("clamps a long note and offers Selengkapnya, switching to Ringkas when opened", () => {
    expect(long.length).toBeGreaterThanOrEqual(OCCURRENCE_NOTES_EXPAND_FROM);
    render(<OccurrenceNotes notes={long} />);
    const details = document.querySelector("details") as HTMLDetailsElement;
    expect(details.querySelector("summary")).toHaveTextContent("Selengkapnya");
    expect(details.querySelector(".line-clamp-2")).toHaveTextContent(long);
    expect(details.querySelector(".group-open\\:inline-flex")).toHaveTextContent("Ringkas");
  });

  it("shows markup as literal text", () => {
    render(<OccurrenceNotes notes="<b>tebal</b>" />);
    expect(screen.getByText("<b>tebal</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).not.toBeInTheDocument();
  });

  // Task 10.28: tapping the summary before React has hydrated adds `open` to server HTML that has none.
  it("hydrates without a warning when the details was opened before hydration, and stays open", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(<OccurrenceNotes notes={long} />);
    container.querySelector("details")?.setAttribute("open", "");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      hydrateRoot(container, <OccurrenceNotes notes={long} />);
    });

    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector("details")).toHaveAttribute("open");
  });
});
