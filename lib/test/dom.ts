/**
 * Harness for component tests (jsdom). Import it once at the top of a
 * `*.test.tsx` that starts with `// @vitest-environment jsdom`:
 *
 *   import { render, screen, userEvent } from "@/lib/test/dom";
 *
 * It registers the jest-dom matchers (`toBeInTheDocument`, `toHaveValue`, …)
 * and unmounts what a test rendered, because vitest runs without globals and
 * Testing Library's own auto-cleanup needs a global `afterEach`.
 * Server actions and `next/*` hooks are not available in jsdom: mock them
 * with `vi.mock` in the test, as the page tests do.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

export { act, render, screen, waitFor, within } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
