// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("./actions", () => ({ loginAction: vi.fn() }));

import { loginAction } from "./actions";
import { LoginForm } from "./login-form";

const login = vi.mocked(loginAction);

describe("LoginForm", () => {
  beforeEach(() => {
    login.mockReset();
  });

  it("sends the username and password", async () => {
    login.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Username"), "budi");
    await user.type(screen.getByLabelText("Password"), "rahasia123");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    await vi.waitFor(() => expect(login).toHaveBeenCalled());
    expect(Object.fromEntries((login.mock.calls[0][1] as FormData).entries())).toEqual({ username: "budi", password: "rahasia123" });
  });

  it("after a wrong password keeps the username, clears the password and shows the error", async () => {
    login.mockResolvedValue({ error: "Username atau password salah" });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Username"), "budi");
    await user.type(screen.getByLabelText("Password"), "salah");

    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username atau password salah");
    expect(screen.getByLabelText("Username")).toHaveValue("budi");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("asks the phone keyboard for no auto-capitalisation of the username", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Username")).toHaveAttribute("autocapitalize", "none");
  });
});
