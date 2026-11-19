import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UNKNOWN, renderRecord } from "../../../../scripts/decisions/lib.mjs";
import {
  linkSupersedes,
  splitDomainFile,
} from "../../../../scripts/decisions/split.mjs";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/old-domain.md"),
  "utf8",
);
const recs = splitDomainFile(fixture, "database");
const get = (id: string) => {
  const r = recs.find((x: { fm: { id: string } }) => x.fm.id === id);
  if (!r) throw new Error(`no ${id}`);
  return r;
};
const sec = (id: string, h: string) => get(id).sections.get(h) as string;
const lines = (t: string) =>
  new Set(
    t
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );

describe("splitDomainFile", () => {
  it("yields one record per row and block", () => {
    expect(recs.map((r: { fm: { id: string } }) => r.fm.id)).toEqual([
      "D0020",
      "D0023",
      "D0100",
      "D0101",
      "D0102",
      "D0103",
    ]);
  });

  it("maps a table row: Decision, Rationale, Source", () => {
    expect(sec("D0020", "Decision Outcome")).toMatch(
      /^Chosen option: "CQRS-lite: writes go/,
    );
    expect(sec("D0020", "Context and Problem Statement")).toBe(
      "Stable read contracts",
    );
    expect(sec("D0020", "Evidence / More Information")).toBe("Source: P21–30");
    expect(get("D0020").fm.date).toBe("");
    expect(sec("D0023", "Evidence / More Information")).toBe(
      "Decided: 2026-07-09",
    );
    expect(get("D0023").fm.date).toBe("2026-07-09");
  });

  it("maps a block: status, date, Reason, Consequences", () => {
    expect(get("D0100").fm.status).toBe("accepted");
    expect(get("D0100").fm.date).toBe("2026-08-05");
    expect(get("D0100").title).toBe("Dart coordinates ship as millimetres");
    expect(sec("D0100", "Decision Outcome")).toMatch(
      /^Chosen option: "`darts\.location_x`/,
    );
    expect(sec("D0100", "Context and Problem Statement")).toBe(
      "A landing point is one fact.",
    );
    expect(sec("D0100", "Consequences")).toBe(
      "Migration `0017` also adds two foreign keys.",
    );
    expect(sec("D0100", "Evidence / More Information")).toBe(
      "Decided: 2026-08-05",
    );
  });

  it("parses Supersedes lines", () => {
    expect(get("D0101").fm.supersedes).toBe("D0100");
    expect(get("D0100").fm.supersedes).toBe("");
    expect(get("D0102").fm.supersedes).toBe("");
    expect(sec("D0102", "Evidence / More Information")).toContain(
      "Supersedes: none (extends D41)",
    );
    expect(sec("D0100", "Evidence / More Information")).not.toContain(
      "Supersedes",
    );
  });

  it("tags: domain plus load-when keywords present in the record", () => {
    expect(get("D0020").fm.tags).toEqual(["database"]); // "views" is not the word "view"
    expect(get("D0023").fm.tags).toEqual(["database", "schema"]); // "migrations" is not "migration"
    expect(get("D0101").fm.tags).toEqual(["database", "view"]);
    expect(get("D0102").fm.tags).toEqual(["database", "Neon", "seed"]);
  });

  it("sets the fixed fields and fills missing sections", () => {
    for (const r of recs) {
      expect(r.thin).toBe(true);
      expect(r.fm["decision-makers"]).toEqual(["owner"]);
      expect(r.fm.origin).toBe("contemporaneous");
      expect(r.fm.scope).toBe("repository");
      expect(r.sections.get("Confidence")).toBe(UNKNOWN);
    }
    expect(sec("D0020", "Consequences")).toBe(UNKNOWN);
  });

  it("loses no line of a multi-paragraph block", () => {
    const src = (fixture.split("### D102 — ")[1] as string).split(
      "### D103",
    )[0] as string;
    const out = renderRecord(get("D0102"));
    const missing = [...lines(src)].filter(
      (l) =>
        !out.includes(l) &&
        !/^(Status|Decision|Reason|Consequences|Supersedes):/.test(l),
    );
    expect(missing).toEqual([]);
    expect(out).toContain(
      "Second paragraph of the reason, after a blank line.",
    );
  });

  it("fails loudly on a source line it cannot place", () => {
    const bad = fixture.replace(
      "### D101 — Coordinates become centimetres\n",
      "### D101 — Coordinates become centimetres\nstray text\n",
    );
    expect(() => splitDomainFile(bad, "database", { file: "x.md" })).toThrow(
      /x\.md:\d+: text before first field/,
    );
  });

  it("warns on prose outside header, table and blocks", () => {
    const warnings: string[] = [];
    const prose = fixture.replace(/^\| # /m, "Loose prose.\n\n| # ");
    splitDomainFile(prose, "database", {
      file: "x.md",
      warn: (w: string) => warnings.push(w),
    });
    expect(warnings).toEqual([
      expect.stringMatching(/^x\.md:\d+: prose outside/),
    ]);
  });
});

describe("partial supersession and titles", () => {
  it("keeps a Supersedes line with extra words in Evidence only", () => {
    expect(get("D0103").fm.supersedes).toBe("");
    expect(sec("D0103", "Evidence / More Information")).toContain(
      "Supersedes: D102 (in part).",
    );
  });

  it("keeps status-line extras verbatim in Evidence", () => {
    expect(sec("D0103", "Evidence / More Information")).toContain(
      "Refines: D100",
    );
    expect(get("D0103").fm.date).toBe("2026-09-20");
  });

  it("does not supersede the target; it gets a reference line", () => {
    const fresh = splitDomainFile(fixture, "database");
    linkSupersedes(fresh);
    const t = fresh.find((r: { fm: { id: string } }) => r.fm.id === "D0102");
    expect(t.fm.status).toBe("accepted");
    expect(t.fm["superseded-by"]).toBe("");
    expect(t.fm.date).toBe("2026-09-10");
    expect(t.sections.get("Evidence / More Information")).toContain(
      "Referenced by D0103's `Supersedes:` line.",
    );
  });

  it("derives a table-row title from the first clause of Decision", () => {
    expect(get("D0020").title).toBe("CQRS-lite");
    expect(get("D0023").title).toBe("dbmate owns migrations");
  });
});

describe("linkSupersedes", () => {
  it("marks the older record superseded and takes the newer date", () => {
    const fresh = splitDomainFile(fixture, "database");
    linkSupersedes(fresh);
    const old = fresh.find((r: { fm: { id: string } }) => r.fm.id === "D0100");
    expect(old.fm.status).toBe("superseded");
    expect(old.fm["superseded-by"]).toBe("D0101");
    expect(old.fm.date).toBe("2026-09-01");
    const newer = fresh.find(
      (r: { fm: { id: string } }) => r.fm.id === "D0101",
    );
    expect(newer.fm.status).toBe("accepted");
  });

  it("lists several superseders as a YAML list the checker reads", () => {
    const fresh = splitDomainFile(fixture, "database");
    const second = structuredClone(
      fresh.find((r: { fm: { id: string } }) => r.fm.id === "D0101"),
    );
    second.fm.id = "D0110";
    fresh.push(second);
    linkSupersedes(fresh);
    const old = fresh.find((r: { fm: { id: string } }) => r.fm.id === "D0100");
    expect(old.fm["superseded-by"]).toEqual(["D0101", "D0110"]);
    const line = /^superseded-by:.*$/m.exec(renderRecord(old))?.[0];
    expect(line).toBe("superseded-by: [D0101, D0110]");
  });

  it("leaves the older date when the superseder has none", () => {
    const fresh = splitDomainFile(fixture, "database");
    fresh.find((r: { fm: { id: string } }) => r.fm.id === "D0101").fm.date = "";
    linkSupersedes(fresh);
    const old = fresh.find((r: { fm: { id: string } }) => r.fm.id === "D0100");
    expect(old.fm.status).toBe("superseded");
    expect(old.fm.date).toBe("2026-08-05");
  });

  it("fails on an unknown superseded id", () => {
    const fresh = splitDomainFile(fixture, "database").filter(
      (r: { fm: { id: string } }) => r.fm.id !== "D0100",
    );
    expect(() => linkSupersedes(fresh)).toThrow(/D0100/);
  });
});
