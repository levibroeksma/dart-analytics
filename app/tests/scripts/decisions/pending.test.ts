import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(
  __dirname,
  "../../../../scripts/check-decision-pending.sh",
);

function run(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "pending-"));
  const git = (...a: string[]) =>
    execFileSync("git", a, { cwd: dir, stdio: "pipe" });
  git("init", "-q");
  for (const [rel, text] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  git("add", "-A");
  return spawnSync("bash", [script], { cwd: dir, encoding: "utf8" });
}

describe("check-decision-pending.sh", () => {
  it("passes a tree with no pending decisions", () => {
    const r = run({
      "decisions/database/D0001-a.md": "x",
      "decisions/TEMPLATE.md": "cite [pending:<slug>]",
      "DECISIONS.md": "[pending:x]",
      "docs/superpowers/plan.md": "[pending:x]",
    });
    expect(r.status).toBe(0);
  });

  it("fails on a pending file", () => {
    const r = run({ "decisions/database/pending-x.md": "x" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("pending-x.md");
  });

  it("fails on a [pending:slug] citation", () => {
    const r = run({ "docs/architecture/a.md": "see [pending:x]" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("docs/architecture/a.md");
  });

  it("passes a [pending:<slug>] placeholder and fails [pending:my-slug]", () => {
    expect(run({ "docs/a.md": "cite [pending:<slug>]" }).status).toBe(0);
    expect(run({ "docs/a.md": "cite [pending:my-slug]" }).status).toBe(1);
  });

  it("fails on a [pending:domain/slug] citation", () => {
    const r = run({ "docs/architecture/a.md": "see [pending:database/x]" });
    expect(r.status).toBe(1);
  });
});
