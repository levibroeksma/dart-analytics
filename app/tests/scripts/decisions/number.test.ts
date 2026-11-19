import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { numberPending } from "../../../../scripts/decisions/number.mjs";
import { makeTree, recordText } from "./support";

const pend = (extra = {}, title = "A title") =>
  recordText({ id: "pending", date: "", ...extra }, title);

function note(root: string, text: string): string {
  const p = join(dirname(root), "note.md");
  writeFileSync(p, text);
  return p;
}

describe("numberPending", () => {
  it("numbers 1 pending file after mainMaxId and rewrites the citation", () => {
    const root = makeTree({ "api/pending-add-thing.md": pend() });
    const f = note(root, "see [pending:add-thing] here");
    const out = numberPending({ root, mainMaxId: 564, changedFiles: [f] });
    expect(out.renames).toEqual([
      [`${root}/api/pending-add-thing.md`, `${root}/api/D0565-add-thing.md`],
    ]);
    expect(out.rewrites).toEqual([f]);
    expect(readFileSync(f, "utf8")).toBe("see D0565 here");
    const text = readFileSync(`${root}/api/D0565-add-thing.md`, "utf8");
    expect(text).toMatch(/^id: D0565$/m);
    expect(existsSync(`${root}/api/pending-add-thing.md`)).toBe(false);
  });

  it("goes past a higher id already on the branch", () => {
    const root = makeTree({
      "api/D0565-old.md": recordText({ id: "D0565" }),
      "api/pending-new.md": pend(),
    });
    const out = numberPending({ root, mainMaxId: 564, changedFiles: [] });
    expect(out.renames[0][1]).toBe(`${root}/api/D0566-new.md`);
  });

  it("numbers same-slug files in sorted path order with qualified citations", () => {
    const root = makeTree({
      "database/pending-dup.md": pend(),
      "api/pending-dup.md": pend(),
    });
    const f = note(root, "[pending:api/dup] and [pending:database/dup]");
    numberPending({ root, mainMaxId: 10, changedFiles: [f] });
    expect(readFileSync(f, "utf8")).toBe("D0011 and D0012");
    expect(existsSync(`${root}/api/D0011-dup.md`)).toBe(true);
    expect(existsSync(`${root}/database/D0012-dup.md`)).toBe(true);
  });

  it("errors on a bare citation that clashes, and changes nothing", () => {
    const root = makeTree({
      "database/pending-dup.md": pend(),
      "api/pending-dup.md": pend(),
    });
    const f = note(root, "[pending:dup]");
    expect(() =>
      numberPending({ root, mainMaxId: 10, changedFiles: [f] }),
    ).toThrow(/ambiguous/);
    expect(existsSync(`${root}/api/pending-dup.md`)).toBe(true);
    expect(readFileSync(f, "utf8")).toBe("[pending:dup]");
  });

  it("errors on an unresolved citation", () => {
    const root = makeTree({ "api/pending-a.md": pend() });
    const f = note(root, "[pending:nope] [pending:api/zzz]");
    expect(() =>
      numberPending({ root, mainMaxId: 1, changedFiles: [f] }),
    ).toThrow(/nope[\s\S]*api\/zzz/);
  });

  it("leaves a citation in an unchanged file alone", () => {
    const root = makeTree({ "api/pending-a.md": pend() });
    const f = note(root, "[pending:a]");
    const out = numberPending({ root, mainMaxId: 1, changedFiles: [] });
    expect(out.rewrites).toEqual([]);
    expect(readFileSync(f, "utf8")).toBe("[pending:a]");
  });

  it("resolves nested domains", () => {
    const root = makeTree({ "frontend/astro/pending-x.md": pend() });
    const f = note(root, "[pending:frontend/astro/x]");
    numberPending({ root, mainMaxId: 1, changedFiles: [f] });
    expect(readFileSync(f, "utf8")).toBe("D0002");
  });
  it("skips an excluded changed file, even with an unresolved citation", () => {
    const root = makeTree({ "api/pending-a.md": pend() });
    const f = note(root, "[pending:nope]");
    expect(() =>
      numberPending({
        root,
        mainMaxId: 1,
        changedFiles: [f],
        exclusions: [f],
      }),
    ).not.toThrow();
    expect(readFileSync(f, "utf8")).toBe("[pending:nope]");
  });

  it("renumbers a branch id that collides with main and rewrites its citations", () => {
    const root = makeTree({
      "api/D0564-main.md": recordText({ id: "D0564" }),
      "api/D0565-theirs.md": recordText({ id: "D0565" }),
      "api/D0565-mine.md": recordText({ id: "D0565" }),
    });
    const f = note(root, "see D0565 and D565, not D5650 or D0564");
    const out = numberPending({
      root,
      mainMaxId: 565,
      mainFiles: ["api/D0564-main.md", "api/D0565-theirs.md"],
      changedFiles: [f, `${root}/api/D0565-mine.md`],
    });
    expect(out.renames).toEqual([
      [`${root}/api/D0565-mine.md`, `${root}/api/D0566-mine.md`],
    ]);
    expect(readFileSync(f, "utf8")).toBe(
      "see D0566 and D0566, not D5650 or D0564",
    );
    expect(readFileSync(`${root}/api/D0566-mine.md`, "utf8")).toMatch(
      /^id: D0566$/m,
    );
  });

  it("leaves a file that exists on main alone", () => {
    const root = makeTree({
      "api/D0565-theirs.md": recordText({ id: "D0565" }),
    });
    const out = numberPending({
      root,
      mainMaxId: 565,
      mainFiles: ["api/D0565-theirs.md"],
      changedFiles: [],
    });
    expect(out.renames).toEqual([]);
  });

  it("does not renumber a main file the branch moved to another domain", () => {
    const root = makeTree({ "api/D0565-a.md": recordText({ id: "D0565" }) });
    const f = note(root, "see D0565");
    const out = numberPending({
      root,
      mainMaxId: 565,
      mainFiles: ["database/D0565-a.md"],
      changedFiles: [f, `${root}/api/D0565-a.md`],
    });
    expect(out.renames).toEqual([]);
    expect(out.rewrites).toEqual([]);
    expect(readFileSync(f, "utf8")).toBe("see D0565");
  });
});
