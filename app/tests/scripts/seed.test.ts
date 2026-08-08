import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

  it("numbers seeds contiguously from 0001", () => {
    const numbers = seedNames.map((name) => Number(name.slice(0, 4)));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
});
