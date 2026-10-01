import { defineConfig } from "vitest/config";
import base from "./vitest.config";

/**
 * Suites that execute against a live, migrated database named by
 * `DATABASE_URL`. Kept out of `vitest.config.ts` so `npm test` never opens a
 * network connection (tests/CLAUDE.md). Spreads the base rather than merging
 * it: a merge concatenates `include`, which would run every unit test too.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/**/*.itest.ts"],
    setupFiles: [],
    testTimeout: 600_000,
  },
});
