// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";

import { ColumnToggle } from "./column-toggle";

const columns = [
  { key: "grup", label: "Grup" },
  { key: "status", label: "Status" },
];

describe("ColumnToggle inside a filter form (task 7.3)", () => {
  it("saves the column choice without submitting the surrounding filter form", async () => {
    const action = vi.fn(async (formData: FormData) => {
      void formData;
    });
    const onFilterSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form role="search" onSubmit={onFilterSubmit}>
        <ColumnToggle columns={columns} visible={["grup"]} action={action} />
      </form>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Kolom" }));
    await user.click(screen.getByRole("checkbox", { name: "Status" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0].getAll("kolom")).toEqual(["grup", "status"]);
    expect(onFilterSubmit).not.toHaveBeenCalled();
  });
});
