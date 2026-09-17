import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const scripts: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8"),
).scripts;

/**
 * `neon env pull` writes an existing `.env` but falls back to `.env.local`
 * when none exists, so a script that leaves the target implicit works only on
 * a machine that already has the file — and silently pulls somewhere else on a
 * fresh clone or worktree, leaving `env:mirror` and every dbmate script with no
 * `.env` at all (issue #398).
 */
describe("Neon env scripts", () => {
  it("pins the dev env file instead of relying on one already existing", () => {
    expect(scripts["env:dev"]).toContain("--file .env");
    expect(scripts["env:dev"]).toContain("--no-env-pull");
  });

  it("pins the production env file", () => {
    expect(scripts["env:prod"]).toContain("--file .env.production");
  });

  it("mirrors the PUBLIC_ auth URL into the same file it pulled", () => {
    expect(scripts["env:dev"]).toContain("env:mirror -- --file .env");
    expect(scripts["env:prod"]).toContain(
      "env:mirror -- --file .env.production",
    );
  });
});
