// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "./dom";

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>klik {n}</button>;
}

describe("component test harness", () => {
  it("renders in jsdom, handles events and has jest-dom matchers", async () => {
    render(<Counter />);
    await userEvent.setup().click(screen.getByRole("button", { name: "klik 0" }));
    expect(screen.getByRole("button", { name: "klik 1" })).toBeInTheDocument();
  });

  it("unmounts between tests", () => {
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
