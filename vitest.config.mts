import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  // The project's tsconfig sets `jsx: "preserve"` (Next's own SWC compiler does the
  // real transform at build time); Vite would otherwise inherit that and leave JSX
  // untransformed when a test imports a page/component module directly.
  oxc: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    // Component tests are `*.test.tsx` and opt in to jsdom per file (`// @vitest-environment jsdom`, see lib/test/dom.ts).
    include: ["**/*.test.{ts,tsx}"],
    // Agent worktrees under .claude/ are full repo copies; never run their tests.
    exclude: ["**/node_modules/**", ".claude/**"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Tests share one SQLite file; keep file execution sequential to avoid write contention.
    fileParallelism: false,
  },
});
