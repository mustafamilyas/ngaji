// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

const router = { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/dashboard/tampilan/actions", () => ({
  createMemberViewAction: vi.fn(),
  transferMemberViewAction: vi.fn(),
  updateMemberViewAction: vi.fn(),
}));

import { createMemberViewAction, transferMemberViewAction, updateMemberViewAction } from "@/app/dashboard/tampilan/actions";
import { emptyDefinition } from "@/lib/validation/member-view";
import { ViewActions } from "./view-actions";

const create = vi.mocked(createMemberViewAction);
const transfer = vi.mocked(transferMemberViewAction);
const update = vi.mocked(updateMemberViewAction);
const ok = { ok: true, data: { id: 12 } } as never;
const definition = emptyDefinition();

const renderActions = (props: Partial<React.ComponentProps<typeof ViewActions>> = {}) =>
  render(
    <ViewActions
      viewId={4}
      viewName="Pemuda Aktif"
      definition={definition}
      basePath="/dashboard/tampilan/4"
      isDraft={false}
      isOwner
      canTransfer={false}
      {...props}
    />,
  );

describe("ViewActions", () => {
  beforeEach(() => {
    for (const mock of [create, transfer, update, router.refresh, router.push, router.replace]) mock.mockReset();
  });

  describe("which buttons exist", () => {
    it("owner of a saved view: rename and save as new, no draft buttons", () => {
      renderActions();
      expect(screen.getByRole("button", { name: /Ubah nama/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Simpan sebagai baru/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Batalkan" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Ambil alih/ })).not.toBeInTheDocument();
    });

    it("someone else's view: only save as new", () => {
      renderActions({ isOwner: false });
      expect(screen.queryByRole("button", { name: /Ubah nama/ })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Simpan sebagai baru/ })).toBeInTheDocument();
    });

    it("an unsaved view (no id): only save as new, even for the owner", () => {
      renderActions({ viewId: null, isDraft: true });
      expect(screen.queryByRole("button", { name: /Ubah nama/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Batalkan" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Simpan sebagai baru/ })).toBeInTheDocument();
    });

    it("a draft of the owner's view adds Batalkan and Simpan", () => {
      renderActions({ isDraft: true });
      expect(screen.getByRole("button", { name: "Batalkan" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Simpan" })).toBeInTheDocument();
    });

    it("Ambil alih only when the viewer may take over", () => {
      renderActions({ canTransfer: true });
      expect(screen.getByRole("button", { name: /Ambil alih/ })).toBeInTheDocument();
    });
  });

  describe("Ambil alih", () => {
    it("transfers the view and refreshes", async () => {
      transfer.mockResolvedValue(ok);
      renderActions({ canTransfer: true });

      await userEvent.setup().click(screen.getByRole("button", { name: /Ambil alih/ }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
      expect(transfer).toHaveBeenCalledWith({ viewId: 4 });
    });

    it("shows the server error and does not refresh", async () => {
      transfer.mockResolvedValue({ ok: false, error: "Tidak diizinkan" });
      renderActions({ canTransfer: true });

      await userEvent.setup().click(screen.getByRole("button", { name: /Ambil alih/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Tidak diizinkan");
      expect(router.refresh).not.toHaveBeenCalled();
    });
  });

  describe("draft buttons", () => {
    it("Batalkan drops the draft by replacing the URL without scrolling", async () => {
      renderActions({ isDraft: true });

      await userEvent.setup().click(screen.getByRole("button", { name: "Batalkan" }));

      expect(router.replace).toHaveBeenCalledWith("/dashboard/tampilan/4", { scroll: false });
      expect(update).not.toHaveBeenCalled();
    });

    it("Simpan saves the definition, then drops the draft from the URL", async () => {
      update.mockResolvedValue(ok);
      renderActions({ isDraft: true });

      await userEvent.setup().click(screen.getByRole("button", { name: "Simpan" }));

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/tampilan/4", { scroll: false }));
      expect(update).toHaveBeenCalledWith({ viewId: 4, definition });
    });

    it("Simpan keeps the draft and shows the server error when saving fails", async () => {
      update.mockResolvedValue({ ok: false, error: "Tampilan diubah orang lain" });
      renderActions({ isDraft: true });

      await userEvent.setup().click(screen.getByRole("button", { name: "Simpan" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Tampilan diubah orang lain");
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe("Ubah nama dialog", () => {
    async function open(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /Ubah nama/ }));
      return screen.findByRole("dialog");
    }

    it("starts with the current name", async () => {
      renderActions();
      const dialog = await open(userEvent.setup());

      expect(within(dialog).getByLabelText("Nama")).toHaveValue("Pemuda Aktif");
      expect(within(dialog).getByText("Nama harus unik di grup Anda.")).toBeInTheDocument();
    });

    it("renames, refreshes and closes", async () => {
      update.mockResolvedValue(ok);
      const user = userEvent.setup();
      renderActions();
      const dialog = await open(user);
      await user.clear(within(dialog).getByLabelText("Nama"));
      await user.type(within(dialog).getByLabelText("Nama"), "Pemuda Baru");

      await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(update).toHaveBeenCalledWith({ viewId: 4, name: "Pemuda Baru" });
      expect(router.refresh).toHaveBeenCalledOnce();
    });

    it("shows the server error inline, keeps the typed name and stays open", async () => {
      update.mockResolvedValue({ ok: false, error: "Nama sudah dipakai" });
      const user = userEvent.setup();
      renderActions();
      const dialog = await open(user);
      await user.clear(within(dialog).getByLabelText("Nama"));
      await user.type(within(dialog).getByLabelText("Nama"), "Duplikat");

      await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nama sudah dipakai");
      expect(within(dialog).getByLabelText("Nama")).toHaveValue("Duplikat");
      expect(router.refresh).not.toHaveBeenCalled();
    });

    it("forgets an abandoned edit and the error when reopened", async () => {
      update.mockResolvedValue({ ok: false, error: "Nama sudah dipakai" });
      const user = userEvent.setup();
      renderActions();
      let dialog = await open(user);
      await user.type(within(dialog).getByLabelText("Nama"), " X");
      await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
      await within(dialog).findByRole("alert");
      await user.click(within(dialog).getByRole("button", { name: "Batal" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      dialog = await open(user);

      expect(within(dialog).getByLabelText("Nama")).toHaveValue("Pemuda Aktif");
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Simpan sebagai baru dialog", () => {
    async function open(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /Simpan sebagai baru/ }));
      return screen.findByRole("dialog");
    }

    it("starts empty", async () => {
      renderActions();
      const dialog = await open(userEvent.setup());

      expect(within(dialog).getByLabelText("Nama")).toHaveValue("");
    });

    it("creates the view from the current definition and opens it", async () => {
      create.mockResolvedValue({ ok: true, data: { id: 12 } } as never);
      const user = userEvent.setup();
      renderActions();
      const dialog = await open(user);
      await user.type(within(dialog).getByLabelText("Nama"), "Salinan");

      await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/tampilan/12"));
      expect(create).toHaveBeenCalledWith({ name: "Salinan", definition });
    });

    it("shows the server error and does not navigate", async () => {
      create.mockResolvedValue({ ok: false, error: "Nama sudah dipakai" });
      const user = userEvent.setup();
      renderActions();
      const dialog = await open(user);
      await user.type(within(dialog).getByLabelText("Nama"), "Salinan");

      await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nama sudah dipakai");
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
