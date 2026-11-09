// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

import { GroupFilter } from "./group-filter";

const groups = [
  { id: 1, parentId: null, name: "Pusat", path: "1/" },
  { id: 2, parentId: 1, name: "Daerah Bandung", path: "1/2/" },
  { id: 3, parentId: 2, name: "Desa Cicendo", path: "1/2/3/" },
];

async function open(props: Partial<React.ComponentProps<typeof GroupFilter>> = {}) {
  render(
    <form>
      <GroupFilter groups={groups} selected={[]} {...props} />
    </form>,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: /Semua grup/ }));
}

describe("GroupFilter touch sizes (task 8.14)", () => {
  it("has a 44px search field with 16px text below xl", async () => {
    await open();
    const input = screen.getByRole("textbox", { name: "Cari grup" });
    expect(input.className).toContain("h-11");
    expect(input.className).toContain("text-base");
  });

  it("gives each group row a 44px target and 16px text", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Pusat" }).className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "Pusat" }).className).toContain("text-base");
  });

  it("gives the expand/collapse chevrons a 44px target", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Tutup Pusat" }).className).toContain("size-11");
    expect(screen.getByRole("button", { name: "Buka Daerah Bandung" }).className).toContain("size-11");
  });

  it("gives the 'pilih dengan turunannya' shortcut a 44px target", async () => {
    await open({ withDescendantsAction: true });
    expect(screen.getByRole("button", { name: "Pilih Pusat dengan turunannya" }).className).toContain("size-11");
  });

  it("gives Kosongkan and Terapkan 44px height and 16px text", async () => {
    await open();
    for (const name of ["Kosongkan", "Terapkan"]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("h-11");
      expect(button.className).toContain("text-base");
    }
  });

  it("keeps the compact desktop sizes from xl", async () => {
    await open();
    expect(screen.getByRole("textbox", { name: "Cari grup" }).className).toContain("xl:h-8");
    expect(screen.getByRole("button", { name: "Terapkan" }).className).toContain("xl:h-8");
  });
});
