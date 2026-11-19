import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { UNKNOWN, renderRecord } from "../../../../scripts/decisions/lib.mjs";

type Fm = Record<string, string | string[]>;

export function recordText(over: Fm = {}, title = "A title"): string {
  const fm: Fm = {
    id: "D0001",
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
  const names = [
    "Context and Problem Statement",
    "Decision Drivers",
    "Considered Options",
    "Decision Outcome",
    "Consequences",
    "Confidence",
    "Revisit When",
    "Confirmation",
    "Pros and Cons of the Options",
    "Evidence / More Information",
  ];
  return renderRecord({
    fm,
    title,
    thin: false,
    sections: new Map(names.map((n) => [n, UNKNOWN])),
  });
}

export function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "decisions-"));
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, "decisions", rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  return join(root, "decisions");
}
