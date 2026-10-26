import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listFiles } from "../../../scripts/design-sync/files";

describe("design-sync listFiles", () => {
  const root = mkdtempSync(join(tmpdir(), "ds-files-"));
  mkdirSync(join(root, "nav"));
  writeFileSync(join(root, "b.svg"), "");
  writeFileSync(join(root, "a.svg"), "");
  writeFileSync(join(root, ".DS_Store"), "");
  writeFileSync(join(root, "nav/c.svg"), "");

  it("lists files recursively as sorted /-separated paths, skipping dotfiles", () => {
    expect(listFiles(root)).toEqual(["a.svg", "b.svg", "nav/c.svg"]);
  });

  it("stays at the top level when not recursive", () => {
    expect(listFiles(root, false)).toEqual(["a.svg", "b.svg"]);
  });

  it("returns nothing for a missing directory", () => {
    expect(listFiles(join(root, "missing"))).toEqual([]);
  });
});
