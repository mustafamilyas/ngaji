// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("./actions", () => ({ changePasswordAction: vi.fn() }));

import { changePasswordAction } from "./actions";
import { ChangePasswordForm } from "./change-password-form";

const change = vi.mocked(changePasswordAction);

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    change.mockReset();
  });

  // Task 10.37 decision: unlike the other forms, the password fields are cleared after every attempt on purpose.
  it("shows the error and clears both password fields", async () => {
    change.mockResolvedValue({ error: "Password saat ini salah" });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText("Password saat ini"), "salah");
    await user.type(screen.getByLabelText("Password baru"), "passwordbaru1");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Password saat ini salah");
    expect(screen.getByLabelText("Password saat ini")).toHaveValue("");
    expect(screen.getByLabelText("Password baru")).toHaveValue("");
  });
});
