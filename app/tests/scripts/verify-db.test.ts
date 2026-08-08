import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const verificationDir = fileURLToPath(
  new URL("../../../database/verification", import.meta.url),
);
const runnerSource = readFileSync(
  fileURLToPath(new URL("../../scripts/verify-db.ts", import.meta.url)),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../package.json", import.meta.url)),
    "utf8",
  ),
) as { scripts: Record<string, string> };

const verificationFiles = readdirSync(verificationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/**
 * These scripts assert against a live database, so nothing here can execute
 * them — that is the point of the runner. What is testable is the contract the
 * runner and the SQL have to hold up between them: every script must roll back
 * (they run against a seeded dev branch, not a scratch database), the runner
 * must not wrap them in a transaction of its own that would swallow that
 * rollback, and a FAIL must reach the shell as a non-zero exit rather than
 * scrolling past in the output.
 */
describe("verification runner", () => {
  it("finds verification files to run", () => {
    expect(verificationFiles.length).toBeGreaterThan(0);
  });

  it("is wired to an npm script", () => {
    expect(packageJson.scripts["db:verify"]).toContain("scripts/verify-db.ts");
  });

  it("reads the verification directory rather than hardcoding a list", () => {
    expect(runnerSource).toContain("readdirSync");
    expect(runnerSource).not.toMatch(/"\.\.\/database\/verification\/\d{4}_/);
  });

  it("exits non-zero when a check fails", () => {
    expect(runnerSource).toContain("process.exit(1)");
  });

  it("does not open a transaction that would swallow a script's ROLLBACK", () => {
    expect(runnerSource).not.toMatch(/\bBEGIN\b/);
    expect(runnerSource).not.toMatch(/sql\.begin\(/);
  });

  it.each(verificationFiles)("%s ends in ROLLBACK", (name) => {
    const sql = readFileSync(`${verificationDir}/${name}`, "utf8");
    const statements = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("--"));

    expect(statements.at(-1)).toBe("ROLLBACK;");
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).not.toMatch(/^COMMIT;$/m);
  });

  it.each(verificationFiles)(
    "%s resolves seeded lookups by implementation_key",
    (name) => {
      const sql = readFileSync(`${verificationDir}/${name}`, "utf8");
      expect(sql).toContain("implementation_key");
    },
  );

  it.each(verificationFiles)(
    "%s is registered in database/README.md",
    (name) => {
      const readme = readFileSync(
        fileURLToPath(new URL("../../../database/README.md", import.meta.url)),
        "utf8",
      );
      expect(readme).toContain(name);
    },
  );
});
