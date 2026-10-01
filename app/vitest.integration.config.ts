import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

/**
 * Suites that execute against a live, migrated database named by
 * `DATABASE_URL`. Kept out of `vitest.config.ts` so `npm test` never opens a
 * network connection (tests/CLAUDE.md).
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["tests/integration/**/*.itest.ts"],
      setupFiles: [],
      testTimeout: 60_000,
    },
  }),
);
