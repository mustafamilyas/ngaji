// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/dashboard/survei/actions", () => ({ deleteSurveyResponseAction: vi.fn() }));

import { deleteSurveyResponseAction } from "@/app/dashboard/survei/actions";
import { DeleteResponseButton } from "./delete-response-button";

const remove = vi.mocked(deleteSurveyResponseAction);

async function open(user: ReturnType<typeof userEvent.setup>) {
  render(<DeleteResponseButton surveyId={3} memberId={11} memberName="Siti" />);
  await user.click(screen.getByRole("button", { name: "Hapus respons Siti" }));
  return screen.findByRole("dialog");
}

describe("DeleteResponseButton", () => {
  beforeEach(() => {
    remove.mockReset();
    refresh.mockReset();
  });

  it("asks for confirmation naming the member, without deleting yet", async () => {
    const dialog = await open(userEvent.setup());

    expect(within(dialog).getByRole("heading", { name: "Hapus respons?" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Jawaban Siti untuk survei ini akan dihapus permanen/)).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the response, refreshes the page and closes", async () => {
    remove.mockResolvedValue({ ok: true, data: { memberId: 11 } });
    const user = userEvent.setup();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Hapus" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledWith({ surveyId: 3, memberId: 11 });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open with the server error and does not refresh", async () => {
    remove.mockResolvedValue({ ok: false, error: "Respons tidak ditemukan" });
    const user = userEvent.setup();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Hapus" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Respons tidak ditemukan");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hapus" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Batal closes without deleting", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Batal" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });
});
