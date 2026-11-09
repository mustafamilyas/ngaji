// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";
import { AuditDetailDialog } from "./audit-detail-dialog";

const detail = JSON.stringify({ before: { name: "Lama" }, after: { name: "Baru" } }, null, 2);

describe("AuditDetailDialog", () => {
  it("shows the snapshot only after the trigger is pressed", async () => {
    const user = userEvent.setup();
    render(<AuditDetailDialog title="member.update" subtitle="27 Okt 2026 10:00 · Budi" detail={detail} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Detail member.update" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "member.update" })).toBeInTheDocument();
    expect(within(dialog).getByText("27 Okt 2026 10:00 · Budi")).toBeInTheDocument();
    // `pre` keeps the JSON formatting, so compare the raw text
    expect(dialog.querySelector("pre")?.textContent).toBe(detail);
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(<AuditDetailDialog title="user.create" subtitle="x" detail="{}" />);
    await user.click(screen.getByRole("button", { name: "Detail user.create" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
