import { describe, expect, it } from "vitest";
import type { DiffReport } from "../../../scripts/design-sync/cli";
import type { Area, Classified } from "../../../scripts/design-sync/lock";
import { publishPlan } from "../../../scripts/design-sync/publish";

const side = { path: "p", hash: "h" };

const item = (
  id: string,
  area: Area,
  status: Classified["status"],
  proposal: Classified["proposal"],
  sides: "both" | "design" | "code" = "both",
): Classified => ({
  id,
  area,
  design: sides === "code" ? null : side,
  code: sides === "design" ? null : side,
  comparable: area !== "components",
  status,
  proposal,
});

const reports = (items: Classified[]): DiffReport[] =>
  (["tokens", "assets", "components"] as const).map((area) => ({
    area,
    items: items.filter((i) => i.area === area),
    values: {},
  }));

const empty = { publish: [], conflicts: [], newOnMain: [] };

describe("design-sync publish plan", () => {
  it("publishes code-only changes for tokens and assets", () => {
    const r = reports([
      item("var:--a", "tokens", "mismatch", "code-to-design"),
      item("icon:x.svg", "assets", "mismatch", "code-to-design"),
      item("var:--b", "tokens", "mismatch", "design-to-code"),
      item("var:--c", "tokens", "in-sync", null),
    ]);
    expect(publishPlan(r, [], ["var:--a", "icon:x.svg", "var:--b"])).toEqual({
      ...empty,
      publish: ["var:--a", "icon:x.svg"],
    });
  });

  it("conflicts when both changed", () => {
    const r = reports([item("var:--a", "tokens", "mismatch", "owner")]);
    expect(publishPlan(r, [], ["var:--a"])).toEqual({
      ...empty,
      conflicts: ["var:--a"],
    });
  });

  it("conflicts when marked ready", () => {
    const r = reports([
      item("var:--a", "tokens", "mismatch", "code-to-design"),
    ]);
    expect(publishPlan(r, [{ id: "var:--a" }], ["var:--a"])).toEqual({
      ...empty,
      conflicts: ["var:--a"],
    });
  });

  it("conflicts when the item's area is marked ready", () => {
    const r = reports([
      item("var:--a", "tokens", "mismatch", "code-to-design"),
    ]);
    expect(publishPlan(r, [{ id: "area:tokens" }], ["var:--a"])).toEqual({
      ...empty,
      conflicts: ["var:--a"],
    });
  });

  it("conflicts when main deleted a synced item", () => {
    const r = reports([
      item("icon:x.svg", "assets", "mismatch", "code-to-design", "design"),
    ]);
    expect(publishPlan(r, [], ["icon:x.svg"])).toEqual({
      ...empty,
      conflicts: ["icon:x.svg"],
    });
  });

  it("leaves a never-synced item on both sides to the manual flow", () => {
    const r = reports([item("var:--a", "tokens", "mismatch", "owner")]);
    expect(publishPlan(r, [], [])).toEqual(empty);
  });

  it("never publishes components", () => {
    const r = reports([
      item("component:Button", "components", "mismatch", "code-to-design"),
    ]);
    expect(publishPlan(r, [], ["component:Button"])).toEqual(empty);
  });

  it("never publishes code-only tokens", () => {
    const r = reports([
      {
        ...item("var:--v", "tokens", "code-only", null, "code"),
        codeOnly: true,
      },
    ]);
    expect(publishPlan(r, [], [])).toEqual(empty);
  });

  it("lists new items on main", () => {
    const r = reports([
      item("var:--new", "tokens", "mismatch", "owner", "code"),
      item("var:--gone", "tokens", "mismatch", "owner", "code"),
    ]);
    expect(publishPlan(r, [], ["var:--gone"])).toEqual({
      ...empty,
      newOnMain: ["var:--new"],
      conflicts: ["var:--gone"],
    });
  });
});
