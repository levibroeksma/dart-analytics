import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FM_KEYS,
  HEADINGS,
  UNKNOWN,
  listRecords,
  parseRecord,
  renderRecord,
  slugify,
  validateRecord,
} from "../../../../scripts/decisions/lib.mjs";

const OPTS = { maxBaselineId: 564 };

function rec(over: Record<string, string | string[]> = {}) {
  const fm: Record<string, string | string[]> = {
    id: "D0020",
    status: "accepted",
    date: "2026-01-02",
    origin: "contemporaneous",
    "original-date": "",
    tags: ["database"],
    scope: "repository",
    "decision-makers": ["owner"],
    consulted: [],
    informed: [],
    supersedes: "",
    "superseded-by": "",
    ...over,
  };
  const sections = new Map(HEADINGS.map((h) => [h, UNKNOWN]));
  return { fm, title: "Some title", sections, thin: false };
}
const p = (id: string) => `decisions/database/${id}-some-title.md`;

const stripFmComments = (t: string) => {
  const [, fm, rest] = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/.exec(t) as string[];
  return fm.replace(/[ \t]+#.*$/gm, "") + rest;
};

describe("slugify", () => {
  it("keeps a-z0-9- and 6 words", () => {
    expect(
      slugify("Migrations `0001`–`0053` are closed to in-place edits"),
    ).toBe("migrations-0001-0053-are-closed-to");
  });
  it("drops quotes, slashes and em dashes", () => {
    expect(slugify(`"A/B" — it's café`)).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("parse/render", () => {
  it("round-trips TEMPLATE.md (frontmatter comments normalised)", () => {
    const t = readFileSync("../decisions/TEMPLATE.md", "utf8");
    expect(renderRecord(parseRecord(t))).toBe(stripFmComments(t));
  });
  it("keeps the thin marker after frontmatter", () => {
    const r = rec();
    r.thin = true;
    const text = renderRecord(r);
    expect(text).toContain("---\n<!-- backfill: pending -->\n\n# Some title");
    expect(parseRecord(text).thin).toBe(true);
    expect(renderRecord(parseRecord(text))).toBe(text);
  });
  it("keeps multi-paragraph section bodies", () => {
    const r = rec();
    r.sections.set("Consequences", "line 1\n\nline 2\n* item");
    expect(parseRecord(renderRecord(r)).sections.get("Consequences")).toBe(
      "line 1\n\nline 2\n* item",
    );
  });
});

describe("validateRecord", () => {
  it("accepts a valid record", () => {
    expect(validateRecord(rec(), p("D0020"), OPTS)).toEqual([]);
  });
  it("rejects a missing heading", () => {
    const r = rec();
    r.sections.delete("Confidence");
    const e = validateRecord(r, p("D0020"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/^decisions\/.*missing heading "Confidence"/);
  });
  it("rejects headings out of order", () => {
    const r = rec();
    const a = r.sections.get("Confidence") as string;
    r.sections.delete("Confidence");
    r.sections.set("Confidence", a);
    const e = validateRecord(r, p("D0020"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("out of template order");
  });
  it("rejects a key out of order", () => {
    const r = rec();
    const { status, date, ...rest } = r.fm;
    r.fm = { id: "D0020", date, status, ...rest };
    expect(FM_KEYS[1]).toBe("status");
    const e = validateRecord(r, p("D0020"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("frontmatter keys");
  });
  it("rejects non-4-digit supersedes ids, naming the field", () => {
    const e = validateRecord(rec({ supersedes: "D184" }), p("D0020"), OPTS);
    expect(e.join("\n")).toContain("supersedes must hold 4-digit ids");
    const f = validateRecord(
      rec({ "superseded-by": ["D0021", "D22"] }),
      p("D0020"),
      OPTS,
    );
    expect(f.join("\n")).toContain("superseded-by must hold 4-digit ids");
  });

  it("accepts 4-digit and empty supersedes, and checks pending records", () => {
    expect(
      validateRecord(rec({ supersedes: ["D0184", "D0318"] }), p("D0020"), OPTS),
    ).toEqual([]);
    const pend = rec({ id: "pending", status: "proposed", supersedes: "D7" });
    expect(
      validateRecord(pend, "decisions/database/pending-x.md", OPTS).join("\n"),
    ).toContain("supersedes must hold 4-digit ids");
  });

  it("rejects a bad status", () => {
    const e = validateRecord(rec({ status: "Accepted" }), p("D0020"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("status");
  });
  it("rejects a name/id mismatch", () => {
    const e = validateRecord(rec(), p("D0021"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("file name must be D0020-");
  });
  it("pairs pending id with pending- file name", () => {
    const ok = "decisions/api/pending-some-title.md";
    expect(validateRecord(rec({ id: "pending" }), ok, OPTS)).toEqual([]);
    expect(
      validateRecord(rec({ id: "pending" }), p("D0020"), OPTS),
    ).toHaveLength(1);
  });
  it("allows empty date only at or below maxBaselineId", () => {
    expect(
      validateRecord(rec({ id: "D0020", date: "" }), p("D0020"), OPTS),
    ).toEqual([]);
    expect(
      validateRecord(rec({ id: "D0600", date: "" }), p("D0600"), OPTS),
    ).toHaveLength(1);
    expect(
      validateRecord(rec({ id: "pending", date: "" }), "x/pending-a.md", OPTS),
    ).toHaveLength(1);
  });
  it("rejects stray text between the title and the first heading", () => {
    const text = renderRecord(rec()).replace(
      "# Some title\n",
      "# Some title\n\nstray words\n",
    );
    const e = validateRecord(parseRecord(text), p("D0020"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("between the title");
  });
  it("rejects a duplicate heading and keeps both bodies", () => {
    const base = renderRecord(rec());
    const text = `${base}\n## Decision Drivers\nsecond body\n`;
    const r = parseRecord(text);
    expect(r.sections.get("Decision Drivers")).toContain("second body");
    const e = validateRecord(r, p("D0020"), OPTS);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('duplicate heading "Decision Drivers"');
  });
  it("rejects an empty section", () => {
    const r = rec();
    r.sections.set("Decision Drivers", "");
    expect(validateRecord(r, p("D0020"), OPTS)).toHaveLength(1);
  });
});

describe("listRecords", () => {
  it("walks recursively and skips TEMPLATE.md", () => {
    const root = mkdtempSync(join(tmpdir(), "dec-"));
    mkdirSync(join(root, "frontend", "style"), { recursive: true });
    const text = renderRecord(rec());
    writeFileSync(join(root, "TEMPLATE.md"), text);
    writeFileSync(join(root, "frontend", "style", "D0020-a.md"), text);
    writeFileSync(join(root, "D0021-b.md"), text);
    const got = listRecords(root).map((r) => r.path.slice(root.length + 1));
    expect(got).toEqual([
      "D0021-b.md",
      join("frontend", "style", "D0020-a.md"),
    ]);
  });
});
