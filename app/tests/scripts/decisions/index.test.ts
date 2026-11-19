import { describe, expect, it } from "vitest";
import { buildIndex } from "../../../../scripts/decisions/index.mjs";
import { makeTree, recordText } from "./support";

const root = makeTree({
  "database/D0020-b.md": recordText(
    { id: "D0020", tags: ["sql", "x"] },
    "Second",
  ),
  "frontend/style/D0003-a.md": recordText(
    { id: "D0003", tags: ["css"] },
    "First",
  ),
  "api/D0030-c.md": recordText(
    { id: "D0030", status: "rejected", tags: ["sql"] },
    "Third",
  ),
});

describe("buildIndex", () => {
  it("sorts by id with the documented line shape", () => {
    const lines = buildIndex(root);
    expect(lines.map((l: string) => l.split(" | ")[0])).toEqual([
      "D0003",
      "D0020",
      "D0030",
    ]);
    expect(lines[1]).toBe(
      `D0020 | accepted | database | Second | ${root}/database/D0020-b.md`,
    );
    expect(lines[0]).toContain("| frontend/style |");
  });

  it("filters by domain", () => {
    expect(buildIndex(root, { domain: "api" })).toHaveLength(1);
    expect(buildIndex(root, { domain: "frontend/style" })).toHaveLength(1);
  });

  it("filters by tag", () => {
    const lines = buildIndex(root, { tag: "sql" });
    expect(lines.map((l: string) => l.split(" | ")[0])).toEqual([
      "D0020",
      "D0030",
    ]);
  });

  it("filters by status", () => {
    expect(buildIndex(root, { status: "rejected" })).toHaveLength(1);
  });
});
