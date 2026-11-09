// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";
import { MemberHeaderActions } from "./member-header-actions";

describe("MemberHeaderActions", () => {
  it("keeps Tambah anggota as the primary action", () => {
    render(<MemberHeaderActions />);
    expect(screen.getByRole("link", { name: "Tambah anggota" })).toHaveAttribute("href", "/dashboard/anggota/baru");
  });

  it("offers Impor CSV in a menu beside it, not as a second full-width button", async () => {
    render(<MemberHeaderActions />);
    expect(screen.queryByRole("link", { name: "Impor CSV" })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Aksi untuk daftar anggota" }));

    expect(await screen.findByRole("menuitem", { name: "Impor CSV" })).toHaveAttribute("href", "/dashboard/anggota/impor");
  });
});
