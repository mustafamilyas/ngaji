// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { VIEW_MAX_SUMMARIES } from "@/lib/constants";
import { render, screen, userEvent, within } from "@/lib/test/dom";
import { emptyDefinition, type Definition } from "@/lib/validation/member-view";
import { ViewMenu } from "./view-menu";

const levels = [{ depth: 1, name: "Cabang" }];
const tags = [
  { id: 8, label: "prioritas:rendah", key: "prioritas", value: "rendah", groupId: 1 },
  { id: 9, label: "prioritas:tinggi", key: "prioritas", value: "tinggi", groupId: 1 },
];
const withSummaries = (...fields: ("sex" | "status")[]): Definition => ({
  ...emptyDefinition(),
  summaries: fields.map((field) => ({ dimension: { kind: "property" as const, field } })),
});

async function open(definition: Definition) {
  const onChange = vi.fn();
  render(<ViewMenu definition={definition} levels={levels} tags={tags} onChange={onChange} />);
  await userEvent.setup().click(screen.getByRole("button", { name: /Tampilan/ }));
  return { onChange, user: userEvent.setup() };
}

describe("Ringkasan in the Tampilan menu (task 4.3)", () => {
  it("adds a sex summary", async () => {
    const { onChange, user } = await open(emptyDefinition());
    await user.click(screen.getByRole("button", { name: "Tambah ringkasan" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ summaries: [{ dimension: { kind: "property", field: "sex" } }] }));
  });

  it("disables adding at the limit", async () => {
    await open(withSummaries(...Array.from({ length: VIEW_MAX_SUMMARIES }, () => "sex" as const)));
    expect(screen.getByRole("button", { name: "Tambah ringkasan" })).toBeDisabled();
  });

  it("changes the dimension of one summary, offering levels and tag keys", async () => {
    const { onChange, user } = await open(withSummaries("sex", "status"));
    const select = screen.getByRole("combobox", { name: "Ringkasan 2: hitung menurut" });
    expect(within(select).getByRole("option", { name: "Tingkat Cabang" })).toBeInTheDocument();
    await user.selectOptions(select, "Tag: prioritas");
    expect(onChange.mock.calls[0][0].summaries).toEqual([
      { dimension: { kind: "property", field: "sex" } },
      { dimension: { kind: "tagKey", tagId: 8 } },
    ]);
  });

  it("reorders with up/down buttons and disables them at the ends", async () => {
    const { onChange, user } = await open(withSummaries("sex", "status"));
    expect(screen.getByRole("button", { name: "Naikkan ringkasan 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Turunkan ringkasan 2" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Turunkan ringkasan 1" }));
    expect(onChange.mock.calls[0][0].summaries.map((s: { dimension: { field: string } }) => s.dimension.field)).toEqual(["status", "sex"]);
  });

  it("removes a summary", async () => {
    const { onChange, user } = await open(withSummaries("sex"));
    await user.click(screen.getByRole("button", { name: "Hapus ringkasan 1" }));
    expect(onChange.mock.calls[0][0].summaries).toBeUndefined();
  });

  it("shows the age bucket editor for an age summary", async () => {
    await open({ ...emptyDefinition(), summaries: [{ dimension: { kind: "ageBuckets", buckets: [{ label: "Anak", min: 0, max: 12 }] } }] });
    expect(screen.getByLabelText("Nama kelompok")).toHaveValue("Anak");
  });
});
