// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";
import type { RuleGroup } from "@/lib/validation/member-view";
import { RuleGroupEditor } from "./rule-editor";

const tags = [
  { id: 1, label: "binaan" },
  { id: 2, label: "fokus" },
  { id: 3, label: "prioritas:tinggi" },
];

const statusGroup: RuleGroup = { op: "AND", rules: [{ field: "status", operator: "isAnyOf", value: ["AKTIF"] }] };
const tagGroup = (operator: "hasAnyOf" | "hasNoneOf", value: number[]): RuleGroup => ({ op: "AND", rules: [{ field: "tag", operator, value }] });

function setup(group: RuleGroup) {
  const onChange = vi.fn();
  render(<RuleGroupEditor group={group} groups={[]} tags={tags} onChange={onChange} onRemove={vi.fn()} />);
  return { onChange };
}

describe("tag rule in the rule editor", () => {
  it("offers Tag as a column with its two operators", async () => {
    setup(statusGroup);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Kolom"), "tag");
    const operators = screen.getByLabelText("Operator") as HTMLSelectElement;
    expect([...operators.options].map((o) => o.textContent)).toEqual(["memiliki salah satu dari", "tidak memiliki satu pun dari"]);
  });

  it("starts empty and explains that the rule is not applied until a tag is chosen", async () => {
    const { onChange } = setup(statusGroup);
    await userEvent.setup().selectOptions(screen.getByLabelText("Kolom"), "tag");
    expect(screen.getByRole("status")).toHaveTextContent("Belum diterapkan");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("checkbox")).toHaveLength(tags.length);
  });

  it("reports the rule once a tag is checked, and again when more are added", async () => {
    const { onChange } = setup(tagGroup("hasAnyOf", [2]));
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "prioritas:tinggi" }));
    expect(onChange).toHaveBeenLastCalledWith({ op: "AND", rules: [{ field: "tag", operator: "hasAnyOf", value: [2, 3] }] });
  });

  it("shows the current selection as checked", () => {
    setup(tagGroup("hasNoneOf", [1, 3]));
    expect(screen.getByRole("checkbox", { name: "binaan" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "fokus" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "prioritas:tinggi" })).toBeChecked();
  });

  it("filters the list by what is typed", async () => {
    setup(tagGroup("hasAnyOf", [1]));
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Cari tag" }), "prio");
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label") ?? c.parentElement?.textContent)).toEqual(["prioritas:tinggi"]);
  });

  it("says so when the viewer has no tags", () => {
    render(<RuleGroupEditor group={tagGroup("hasAnyOf", [])} groups={[]} tags={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Tidak ada tag.")).toBeInTheDocument();
  });
});
