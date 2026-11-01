// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";
import type { TagOwnerGroup } from "@/lib/tag/list";
import { tagChoices } from "@/lib/tag/choices";
import type { TagBreakdown } from "@/lib/stats";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { TagBreakdownCard } from "./tag-breakdown-card";

const tag = (id: number, key: string, value: string | null = null) => ({ id, groupId: 3, key, value, color: "blue" });
const visible: TagOwnerGroup[] = [
  { group: { id: 3, name: "Kelompok Melati", isOwn: true }, tags: [tag(1, "fokus"), tag(2, "prioritas", "tinggi"), tag(3, "prioritas", "rendah")] },
];
const choices = tagChoices(visible);

const breakdown: TagBreakdown = {
  tagId: 2,
  label: "prioritas",
  kind: "tagKey",
  buckets: [
    { key: "t:2", label: "tinggi", count: 3 },
    { key: "t:3", label: "rendah", count: 1 },
    { key: "t:none", label: "Tanpa nilai", count: 6 },
  ],
};

function setup(props: Partial<React.ComponentProps<typeof TagBreakdownCard>> = {}) {
  return render(
    <TagBreakdownCard
      choices={choices}
      breakdown={null}
      total={10}
      basePath="/dashboard/statistik"
      query={{ tab: "anggota", grup: "3" }}
      {...props}
    />,
  );
}

describe("TagBreakdownCard (task 5.1)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("asks for a tag when none is selected", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Per tag" })).toBeInTheDocument();
    expect(screen.getByText("Pilih tag untuk melihat rinciannya.")).toBeInTheDocument();
  });

  it("says so when the viewer sees no tags", () => {
    setup({ choices: [] });
    expect(screen.getByText("Belum ada tag.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pilih tag/ })).not.toBeInTheDocument();
  });

  it("lists one option per key and navigates keeping the other params", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Pilih tag/ }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: /prioritas/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/statistik?tab=anggota&grup=3&tag=2", { scroll: false });
  });

  it("offers clearing the selection", async () => {
    setup({ breakdown });
    await userEvent.setup().click(screen.getByRole("button", { name: "Hapus pilihan tag" }));
    expect(push).toHaveBeenCalledWith("/dashboard/statistik?tab=anggota&grup=3", { scroll: false });
  });

  it("shows every bucket with count and share as text", () => {
    setup({ breakdown });
    expect(screen.getByRole("button", { name: /prioritas/ })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Tanpa nilai/ });
    expect(row).toHaveTextContent("6");
    expect(row).toHaveTextContent("60%");
    expect(screen.getByRole("row", { name: /tinggi/ })).toHaveTextContent("30%");
  });
});
