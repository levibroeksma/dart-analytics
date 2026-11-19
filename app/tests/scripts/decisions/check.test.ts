import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkLedger } from "../../../../scripts/decisions/check.mjs";
const cli = resolve(__dirname, "../../../../scripts/decisions/check.mjs");
import { makeTree, recordText } from "./support";

describe("checkLedger", () => {
  it("passes a clean tree", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
      "frontend/style/D0002-b.md": recordText({ id: "D0002" }),
      "TEMPLATE.md": "template",
    });
    expect(checkLedger(root, ["D0001", "D0002"])).toEqual([]);
  });

  it("flags a decision heading or row in the router", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
    });
    const router = join(root, "..", "ROUTER-test.md");
    writeFileSync(router, "# Router\n\n### D12 — x\n");
    expect(checkLedger(root, [], router).join("\n")).toContain(
      "router must hold",
    );
    writeFileSync(router, "| D12 | x |\n");
    expect(checkLedger(root, [], router)).toHaveLength(1);
    writeFileSync(router, "# Router\n\nSee D12 and ### mid-line.\n");
    expect(checkLedger(root, [], router)).toEqual([]);
  });

  it("flags a duplicate id", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
      "api/D0001-b.md": recordText({ id: "D0001" }),
    });
    const errs = checkLedger(root, []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("duplicate id D0001");
  });

  it("flags a file name that mismatches its id (via validateRecord)", () => {
    const root = makeTree({
      "database/D0009-a.md": recordText({ id: "D0001" }),
    });
    const errs = checkLedger(root, []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("file name must be D0001");
  });

  it("flags supersedes without a back link", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
      "database/D0002-b.md": recordText({ id: "D0002", supersedes: "D0001" }),
    });
    const errs = checkLedger(root, []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("lacks superseded-by D0002");
  });

  it("flags superseded-by without a forward link", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({
        id: "D0001",
        "superseded-by": "D0002",
      }),
      "database/D0002-b.md": recordText({ id: "D0002" }),
    });
    const errs = checkLedger(root, []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("lacks supersedes D0001");
  });

  it("skips the two-way rule for a pending superseding record", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
      "database/pending-b.md": recordText({
        id: "pending",
        status: "proposed",
        date: "2026-11-19",
        supersedes: "D0001",
      }),
    });
    expect(checkLedger(root, [])).toEqual([]);
  });

  it("accepts links in both directions", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({
        id: "D0001",
        status: "superseded",
        "superseded-by": "D0002",
      }),
      "database/D0002-b.md": recordText({ id: "D0002", supersedes: "D0001" }),
    });
    expect(checkLedger(root, [])).toEqual([]);
  });

  it("flags a missing baseline id", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
    });
    const errs = checkLedger(root, ["D0001", "D0002"]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("baseline id D0002 is missing");
  });

  it("flags a file outside the domain directories", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
      "stray.md": recordText({ id: "D0002" }),
    });
    const errs = checkLedger(root, []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("outside the domain directories");
  });

  it("flags an invalid record", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001", status: "bogus" }),
    });
    const errs = checkLedger(root, []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain("status must be one of");
  });
});

describe("check.mjs CLI", () => {
  it("exits 1 when the baseline file is missing", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
    });
    const r = spawnSync(
      "node",
      [cli, "--root", root, "--baseline", join(root, "nope.txt")],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FAIL: baseline file not found:");
  });

  it("passes with a present baseline", () => {
    const root = makeTree({
      "database/D0001-a.md": recordText({ id: "D0001" }),
    });
    const base = join(root, "..", "base.txt");
    writeFileSync(base, "D0001\n");
    const r = spawnSync("node", [cli, "--root", root, "--baseline", base], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS: 1 records");
  });
});
