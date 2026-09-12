import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Tests share one SQLite file; keep file execution sequential to avoid write contention.
    fileParallelism: false,
  },
});
