// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";

const actions = vi.hoisted(() => ({
  createTagAction: vi.fn(),
  recolorTagAction: vi.fn(),
  renameTagKeyAction: vi.fn(),
  renameTagValueAction: vi.fn(),
  deleteTagAction: vi.fn(),
  deleteTagKeyAction: vi.fn(),
}));
vi.mock("@/app/dashboard/tag/actions", () => actions);

import { KeyMenu, NewTagDialog, TagMenu } from "./tag-manage";

const valueTag = { id: 7, groupId: 3, key: "prioritas", value: "tinggi", color: "red", members: 12, activities: 2 };
const simpleTag = { id: 8, groupId: 3, key: "fokus", value: null, color: "blue", members: 0, activities: 0 };

const ok = { ok: true, data: [] };

async function pick(user: ReturnType<typeof userEvent.setup>, trigger: string, item: string) {
  await user.click(screen.getByRole("button", { name: trigger }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("tag management dialogs (task 5.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of Object.values(actions)) fn.mockResolvedValue(ok);
  });

  describe("NewTagDialog", () => {
    it("creates a tag with the typed name and chosen color, then closes", async () => {
      render(<NewTagDialog />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Tag baru" }));
      await user.type(screen.getByLabelText("Nama tag"), "prioritas:tinggi");
      await user.click(screen.getByRole("radio", { name: "Merah" }));
      await user.click(screen.getByRole("button", { name: "Simpan" }));

      expect(actions.createTagAction).toHaveBeenCalledWith({ name: "prioritas:tinggi", color: "red" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("starts slate, and keeps the dialog open with the server's message on failure", async () => {
      actions.createTagAction.mockResolvedValue({ ok: false, error: 'Tag "fokus" sudah ada' });
      render(<NewTagDialog />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Tag baru" }));
      expect(screen.getByRole("radio", { name: "Abu-abu" })).toBeChecked();
      await user.type(screen.getByLabelText("Nama tag"), "fokus");
      await user.click(screen.getByRole("button", { name: "Simpan" }));

      expect(await screen.findByRole("alert")).toHaveTextContent('Tag "fokus" sudah ada');
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Nama tag")).toHaveValue("fokus");
    });

    it("drops the server's message as soon as the name or color is edited (task 8.24)", async () => {
      actions.createTagAction.mockResolvedValue({ ok: false, error: "Nama tag maksimal 30 karakter" });
      render(<NewTagDialog />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Tag baru" }));
      await user.type(screen.getByLabelText("Nama tag"), "terlalu-panjang");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Nama tag"), "x");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      await user.click(screen.getByRole("radio", { name: "Merah" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("can start from a key to add a value to it", async () => {
      render(<NewTagDialog initialName="prioritas:" triggerLabel="Tambah nilai" />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Tambah nilai" }));
      expect(screen.getByLabelText("Nama tag")).toHaveValue("prioritas:");
    });
  });

  describe("rename dialogs (task 8.24)", () => {
    it("drops the server's message once the new name is edited", async () => {
      actions.renameTagValueAction.mockResolvedValue({ ok: false, error: "Tag sudah ada" });
      render(<TagMenu tag={valueTag} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk prioritas:tinggi", "Ubah nilai");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Tag sudah ada");
      await user.type(screen.getByLabelText("Nilai"), "x");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does the same when renaming a key", async () => {
      actions.renameTagKeyAction.mockResolvedValue({ ok: false, error: "Tag sudah ada" });
      render(<KeyMenu keyName="prioritas" firstTagId={7} values={2} members={1} activities={0} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk kunci prioritas", "Ubah nama kunci");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      await user.type(screen.getByLabelText("Nama kunci"), "x");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("TagMenu", () => {
    it("recolors a tag", async () => {
      render(<TagMenu tag={valueTag} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk prioritas:tinggi", "Ubah warna");
      expect(screen.getByRole("radio", { name: "Merah" })).toBeChecked();
      await user.click(screen.getByRole("radio", { name: "Hijau" }));
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(actions.recolorTagAction).toHaveBeenCalledWith({ tagId: 7, color: "green" });
    });

    it("renames the value of a key value", async () => {
      render(<TagMenu tag={valueTag} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk prioritas:tinggi", "Ubah nilai");
      const field = screen.getByLabelText("Nilai");
      expect(field).toHaveValue("tinggi");
      await user.clear(field);
      await user.type(field, "sangat tinggi");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(actions.renameTagValueAction).toHaveBeenCalledWith({ tagId: 7, newValue: "sangat tinggi" });
    });

    it("renames a simple tag as its key", async () => {
      render(<TagMenu tag={simpleTag} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk fokus", "Ubah nama");
      const field = screen.getByLabelText("Nama");
      await user.clear(field);
      await user.type(field, "perhatian");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(actions.renameTagKeyAction).toHaveBeenCalledWith({ tagId: 8, newKey: "perhatian" });
    });

    it("says how many members and activities use a tag before deleting it", async () => {
      render(<TagMenu tag={valueTag} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk prioritas:tinggi", "Hapus");
      expect(screen.getByText(/12 anggota dan 2 kegiatan/)).toBeInTheDocument();
      expect(actions.deleteTagAction).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Hapus tag" }));
      expect(actions.deleteTagAction).toHaveBeenCalledWith({ tagId: 7 });
    });

    it("says so when a tag is not used anywhere", async () => {
      render(<TagMenu tag={simpleTag} />);
      await pick(userEvent.setup(), "Aksi untuk fokus", "Hapus");
      expect(screen.getByText(/Belum dipakai/)).toBeInTheDocument();
    });

    it("keeps the dialog open and shows the server's message when an action fails", async () => {
      actions.recolorTagAction.mockResolvedValue({ ok: false, error: "Anda tidak memiliki izin untuk melakukan ini" });
      render(<TagMenu tag={valueTag} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk prioritas:tinggi", "Ubah warna");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Anda tidak memiliki izin");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("gives menu items a 44px target below xl", async () => {
    render(<TagMenu tag={valueTag} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Aksi untuk prioritas:tinggi" }));
    for (const item of await screen.findAllByRole("menuitem")) expect(item.className).toContain("min-h-11");
  });

  describe("KeyMenu", () => {
    const key = { keyName: "prioritas", firstTagId: 7, values: 3, members: 12, activities: 2 };

    it("renames the whole key", async () => {
      render(<KeyMenu {...key} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk kunci prioritas", "Ubah nama kunci");
      const field = screen.getByLabelText("Nama kunci");
      await user.clear(field);
      await user.type(field, "urgensi");
      await user.click(screen.getByRole("button", { name: "Simpan" }));
      expect(actions.renameTagKeyAction).toHaveBeenCalledWith({ tagId: 7, newKey: "urgensi" });
    });

    it("warns what deleting a key removes, then deletes it", async () => {
      render(<KeyMenu {...key} />);
      const user = userEvent.setup();
      await pick(user, "Aksi untuk kunci prioritas", "Hapus kunci");
      expect(screen.getByText(/3 nilainya/)).toBeInTheDocument();
      expect(screen.getByText(/12 anggota dan 2 kegiatan/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Hapus kunci" }));
      expect(actions.deleteTagKeyAction).toHaveBeenCalledWith({ tagId: 7 });
    });

    it("opens the new-tag dialog prefilled with the key to add a value", async () => {
      render(<KeyMenu {...key} />);
      await pick(userEvent.setup(), "Aksi untuk kunci prioritas", "Tambah nilai");
      expect(screen.getByLabelText("Nama tag")).toHaveValue("prioritas:");
    });
  });
});
