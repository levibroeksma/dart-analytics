import { describe, expect, it } from "vitest";
import { checkLedger } from "../../../../scripts/decisions/check.mjs";
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
