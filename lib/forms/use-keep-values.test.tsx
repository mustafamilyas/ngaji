// @vitest-environment jsdom
import { useActionState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";
import { useKeepValues } from "./use-keep-values";

type State = { error: string | null; ok: boolean };

/** One uncontrolled field, submitted through `useKeepValues`, with a server action that is told what to answer. */
function Harness({ action, plain = false }: { action: (prev: State, data: FormData) => Promise<State>; plain?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { error: null, ok: false });
  const onSubmit = useKeepValues(formAction);
  return (
    // `plain` is the control: the same form submitted the usual way, which React resets after the action.
    <form {...(plain ? { action: formAction } : { onSubmit })}>
      <label>
        Nama
        <input name="name" defaultValue="" required />
      </label>
      <button type="submit" disabled={pending}>
        Kirim
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p role="status">Tersimpan</p>}
    </form>
  );
}

describe("useKeepValues", () => {
  it("submits the form's values to the action", async () => {
    const action = vi.fn(async (): Promise<State> => ({ error: null, ok: true }));
    const user = userEvent.setup();
    render(<Harness action={action} />);

    await user.type(screen.getByLabelText("Nama"), "Budi");
    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(action).toHaveBeenCalledOnce();
    expect(Object.fromEntries((action.mock.calls[0] as unknown as [State, FormData])[1].entries())).toEqual({ name: "Budi" });
  });

  it("keeps the typed value after the action returns an error", async () => {
    const action = vi.fn(async (): Promise<State> => ({ error: "Ditolak", ok: false }));
    const user = userEvent.setup();
    render(<Harness action={action} />);

    await user.type(screen.getByLabelText("Nama"), "Budi");
    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ditolak");
    expect(screen.getByLabelText("Nama")).toHaveValue("Budi");
  });

  it("control: a plain form action does clear the field (the behaviour this hook exists to avoid)", async () => {
    const action = vi.fn(async (): Promise<State> => ({ error: "Ditolak", ok: false }));
    const user = userEvent.setup();
    render(<Harness action={action} plain />);

    await user.type(screen.getByLabelText("Nama"), "Budi");
    await user.click(screen.getByRole("button", { name: "Kirim" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Nama")).toHaveValue("");
  });

  it("reports pending while the action runs", async () => {
    let finish!: (state: State) => void;
    const action = vi.fn(() => new Promise<State>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<Harness action={action} />);
    await user.type(screen.getByLabelText("Nama"), "Budi");

    await user.click(screen.getByRole("button", { name: "Kirim" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled());

    finish({ error: null, ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Kirim" })).toBeEnabled());
  });

  it("does not submit while a required field is empty (native validation still runs)", async () => {
    const action = vi.fn(async (): Promise<State> => ({ error: null, ok: true }));
    const user = userEvent.setup();
    render(<Harness action={action} />);

    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(action).not.toHaveBeenCalled();
  });
});
