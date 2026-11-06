import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";
import base from "./vitest.config";
import { databaseUrlEnv } from "./scripts/integration-env";

const envFile = (): Record<string, string> =>
  existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};

/**
 * Suites that execute against a live, migrated database named by
 * `DATABASE_URL`. Kept out of `vitest.config.ts` so `npm test` never opens a
 * network connection (tests/CLAUDE.md). Spreads the base rather than merging
 * it: a merge concatenates `include`, which would run every unit test too.
 * `DATABASE_URL` falls back to `.env` when the shell has none.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/**/*.itest.ts"],
    setupFiles: [],
    env: {
      ...base.test?.env,
      ...databaseUrlEnv(envFile(), process.env),
    },
    testTimeout: 600_000,
  },
});
