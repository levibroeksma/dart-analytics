import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiffReport } from "../../../scripts/design-sync/cli";
import type { Classified } from "../../../scripts/design-sync/lock";
import {
  READY_FILE,
  readMarks,
  readyPlan,
} from "../../../scripts/design-sync/ready";

const side = { path: "p", hash: "h" };

const item = (
  id: string,
  status: Classified["status"],
  proposal: Classified["proposal"],
  sides: "both" | "design" | "code" = "both",
): Classified => ({
  id,
  area: id.startsWith("var:") ? "tokens" : "assets",
  design: sides === "code" ? null : side,
  code: sides === "design" ? null : side,
  comparable: true,
  status,
  proposal,
});

const reports = (items: Classified[]): DiffReport[] => [
  {
    area: "tokens",
    items: items.filter((i) => i.area === "tokens"),
    values: {},
  },
  {
    area: "assets",
    items: items.filter((i) => i.area === "assets"),
    values: {},
  },
];

const empty = {
  apply: [],
  conflicts: [],
  oneSided: [],
  inSync: [],
  unknown: [],
};

describe("design-sync ready marks", () => {
  it("applies design-only changes", () => {
    const r = reports([item("var:--accent", "mismatch", "design-to-code")]);
    expect(readyPlan([{ id: "var:--accent" }], r)).toEqual({
      ...empty,
      apply: ["var:--accent"],
    });
  });

  it("conflicts when both changed", () => {
    const r = reports([
      item("var:--a", "mismatch", "owner"),
      item("var:--b", "mismatch", "code-to-design"),
    ]);
    expect(readyPlan([{ id: "var:--a" }, { id: "var:--b" }], r)).toEqual({
      ...empty,
      conflicts: ["var:--a", "var:--b"],
    });
  });

  it("lists one-sided marks for the owner", () => {
    const r = reports([
      item("var:--new", "mismatch", "owner", "design"),
      item("icon:gone.svg", "mismatch", "design-to-code", "code"),
    ]);
    expect(
      readyPlan([{ id: "var:--new" }, { id: "icon:gone.svg" }], r),
    ).toEqual({ ...empty, oneSided: ["var:--new", "icon:gone.svg"] });
  });

  it("clears marks already in sync", () => {
    const r = reports([
      item("var:--a", "in-sync", null),
      item("var:--b", "accepted", null),
    ]);
    expect(readyPlan([{ id: "var:--a" }, { id: "var:--b" }], r)).toEqual({
      ...empty,
      inSync: ["var:--a", "var:--b"],
    });
  });

  it("lists unknown ids", () => {
    const r = reports([item("var:--a", "mismatch", "design-to-code")]);
    expect(readyPlan([{ id: "var:--nope" }, { id: "area:fonts" }], r)).toEqual({
      ...empty,
      unknown: ["var:--nope", "area:fonts"],
    });
  });

  it("expands area marks", () => {
    const r = reports([
      item("var:--a", "mismatch", "design-to-code"),
      item("var:--b", "in-sync", null),
      item("icon:x.svg", "mismatch", "design-to-code"),
    ]);
    expect(readyPlan([{ id: "area:tokens" }, { id: "var:--a" }], r)).toEqual({
      ...empty,
      apply: ["var:--a"],
      inSync: ["var:--b"],
    });
  });

  it("treats a missing or malformed file as no marks", () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-ready-"));
    expect(readMarks(dir)).toEqual([]);
    writeFileSync(join(dir, READY_FILE), "{nope");
    expect(readMarks(dir)).toEqual([]);
    writeFileSync(join(dir, READY_FILE), JSON.stringify({ v: 1 }));
    expect(readMarks(dir)).toEqual([]);
  });

  it("reads marks with their notes", () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-ready-"));
    writeFileSync(
      join(dir, READY_FILE),
      JSON.stringify({
        v: 1,
        items: [
          { id: "var:--accent", note: "final", at: "x", by: "y" },
          { note: "no id" },
        ],
      }),
    );
    expect(readMarks(dir)).toEqual([{ id: "var:--accent", note: "final" }]);
  });
});
