import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "../../scripts/seed";

const seedsDir = fileURLToPath(
  new URL("../../../database/seeds", import.meta.url),
);
const runnerSource = readFileSync(
  fileURLToPath(new URL("../../scripts/seed.ts", import.meta.url)),
  "utf8",
);
const readmeSource = readFileSync(
  fileURLToPath(new URL("../../../database/README.md", import.meta.url)),
  "utf8",
);

const seedNames = readdirSync(seedsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/**
 * `npm run db:seed` once carried a hardcoded file list that stopped at `0004`,
 * so two later seeds were registered in the README but never applied. These
 * guard the two ways that can happen again: the runner drifting from the
 * directory, and the README drifting from either.
 */
describe("seed runner", () => {
  it("finds seed files to apply", () => {
    expect(seedNames.length).toBeGreaterThan(0);
  });

  it("reads the seeds directory rather than hardcoding a list", () => {
    expect(runnerSource).toContain("readdirSync");
    expect(runnerSource).not.toMatch(/"\.\.\/database\/seeds\/\d{4}_/);
  });

  it("registers every seed file in database/README.md", () => {
    const unregistered = seedNames.filter(
      (name) => !readmeSource.includes(name),
    );
    expect(unregistered).toEqual([]);
  });

  /**
   * One known gap rather than contiguity: a seed whose rows were later erased
   * is deleted, not renumbered. `0024` seeded the SWITCHING_TARGET_SCORING
   * exercise type that migration `0048` erased, and shifting every later seed
   * down one would rewrite the README index, the generated tag seed's own
   * filename and every document that names a seed by number. Listing the
   * retired number rather than allowing any gap keeps an *accidental* gap — a
   * seed deleted or never committed — a failure. Ordering is not asserted:
   * `seedNames` is a sorted `readdirSync` over fixed-width prefixes, so
   * ascending is true by construction; a duplicate number is not, and is what
   * the second assertion catches.
   */
  it("numbers seeds from 0001, with 0024 the only retired number", () => {
    const numbers = seedNames.map((name) => Number(name.slice(0, 4)));
    const missing = Array.from(
      { length: Math.max(...numbers) },
      (_, i) => i + 1,
    ).filter((n) => !numbers.includes(n));
    expect(missing).toEqual([24]);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("runs every file twice, so a ledger seed's forward reference to a later-numbered file's row resolves on the second pass", () => {
    const files = ["0007_ruleset_version_capabilities.sql", "0013_new.sql"];
    expect(buildExecutionPlan(files)).toEqual([...files, ...files]);
  });
});
