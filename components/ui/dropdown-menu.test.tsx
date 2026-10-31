// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuTrigger } from "./dropdown-menu";

async function open() {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Aksi</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Hapus</DropdownMenuItem>
        <DropdownMenuLinkItem href="/x">Tautan</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Menu" }));
}

describe("DropdownMenu touch sizes (task 8.16)", () => {
  it("gives every item a 44px target and 16px text below xl", async () => {
    await open();
    for (const item of await screen.findAllByRole("menuitem")) {
      expect(item.className, item.textContent ?? "").toContain("min-h-11");
      expect(item.className, item.textContent ?? "").toContain("text-base");
    }
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("returns to the compact size from xl", async () => {
    await open();
    for (const item of await screen.findAllByRole("menuitem")) {
      expect(item.className).toContain("xl:min-h-0");
      expect(item.className).toContain("xl:text-sm");
    }
  });
});
