import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
// The row-tag components import the tag actions, which reach the auth module.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { ViewMembersTable, type ViewMemberRow } from "./view-table";

const row = (tags: ViewMemberRow["tags"]): ViewMemberRow => ({ id: 1, name: "Ahmad Fauzi", tags });

describe("ViewMembersTable tag column (task 5.4)", () => {
  it("shows a member's tags as read-only chips under a Tag header", () => {
    const html = renderToStaticMarkup(
      <ViewMembersTable
        members={[row([{ tag: { id: 1, groupId: 1, key: "prioritas", value: "tinggi", color: "red" } }])]}
        columns={["tag"]}
        asOf="2026-10-31"
      />,
    );
    expect(html).toContain(">Tag<");
    expect(html).toContain("prioritas:tinggi");
    expect(html).not.toContain("Atur tag");
    expect(html).not.toContain("Hapus tag");
  });

  it("renders no tag cell when the column is not chosen", () => {
    const html = renderToStaticMarkup(
      <ViewMembersTable members={[row([{ tag: { id: 1, groupId: 1, key: "rahasia", value: null, color: "red" } }])]} columns={["status"]} asOf="2026-10-31" />,
    );
    expect(html).not.toContain("rahasia");
  });
});

describe("ViewMembersTable kode column (member-code spec \"Display\")", () => {
  it("shows the member code under a Kode header", () => {
    const html = renderToStaticMarkup(
      <ViewMembersTable members={[{ id: 1, name: "Ahmad Fauzi", code: "ANR-7K3MQ9" }]} columns={["kode"]} asOf="2026-10-31" />,
    );
    expect(html).toContain(">Kode<");
    expect(html).toContain("ANR-7K3MQ9");
  });
});
