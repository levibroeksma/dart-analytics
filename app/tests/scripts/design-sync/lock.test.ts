import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classify,
  readLock,
  upsertEntries,
  writeLock,
  type Decision,
  type Lock,
  type LockEntry,
} from "../../../scripts/design-sync/lock";

const E = (
  designHash: string | null,
  codeHash: string | null,
  decision: Decision,
): LockEntry => ({
  id: "var:--accent",
  area: "tokens",
  designHash,
  codeHash,
  decision,
  date: "2026-10-26",
});

const lock = (items: LockEntry[]): Lock => ({
  projectId: "p",
  projectUpdatedAt: null,
  pairs: [],
  items,
});

describe("design-sync lock", () => {
  it.each([
    ["h1", "h1", undefined, true, "in-sync", null],
    ["h1", "h2", undefined, true, "mismatch", "owner"],
    [
      "h2",
      "h1",
      E("h1", "h1", "code-wins"),
      true,
      "mismatch",
      "design-to-code",
    ],
    [
      "h1",
      "h2",
      E("h1", "h1", "code-wins"),
      true,
      "mismatch",
      "code-to-design",
    ],
    ["h3", "h2", E("h1", "h1", "code-wins"), true, "mismatch", "owner"],
    [null, "h1", undefined, true, "mismatch", "owner"],
    [
      null,
      "h1",
      E("h1", "h1", "code-wins"),
      true,
      "mismatch",
      "design-to-code",
    ],
    [
      "h1",
      null,
      E("h1", "h1", "code-wins"),
      true,
      "mismatch",
      "code-to-design",
    ],
    ["h1", "h2", E("h1", "h2", "accepted-divergence"), true, "accepted", null],
    ["h1", "h2", undefined, false, "mismatch", "owner"],
    ["h1", "h2", E("h1", "h2", "code-wins"), false, "in-sync", null],
  ] as const)("classify %s/%s", (d, c, entry, comparable, status, proposal) => {
    const result = classify(
      {
        id: "var:--accent",
        area: "tokens",
        design: d === null ? null : { path: "tokens/colors.css", hash: d },
        code: c === null ? null : { path: "src/styles/global.css", hash: c },
        comparable,
      },
      entry,
    );
    expect(result.status).toBe(status);
    expect(result.proposal).toBe(proposal);
  });

  it("writeLock is stable: sorted ids, trailing newline", () => {
    const path = join(mkdtempSync(join(tmpdir(), "ds-lock-")), "lock.json");
    const b = { ...E("h1", "h1", "code-wins"), id: "var:--b" };
    const a = { ...E("h1", "h1", "code-wins"), id: "var:--a" };
    writeLock(path, lock([b, a]));
    const text = readFileSync(path, "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('\n  "projectId"');
    expect(readLock(path).items.map((i) => i.id)).toEqual([
      "var:--a",
      "var:--b",
    ]);
  });

  it("upsertEntries replaces by id", () => {
    const next = upsertEntries(lock([E("h1", "h1", "code-wins")]), [
      E("h2", "h2", "design-wins"),
    ]);
    expect(next.items).toHaveLength(1);
    expect(next.items[0].decision).toBe("design-wins");
  });
});
