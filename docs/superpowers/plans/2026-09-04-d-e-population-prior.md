# D-E Population Prior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the human-run D-E extract (`D-E-extract.md`) into a measured population prior and close D-E in `08-DartBot.md`.

**Architecture:** A pure fold function reuses `zoneCentroid()` to compute each row's centre-relative offset, reducing to one pooled `{sigmaAlongMm, sigmaAcrossMm, biasXMm, biasYMm, outlierRate, sampleSize, excludedCount}`. A thin script reads the extract file, feeds it through, prints the result. The doc is then updated with that result.

**Tech Stack:** TypeScript, Vitest, tsx (existing `app/` toolchain).

## Global Constraints

- Fold logic lives in `app/src/modules/dartbot/`, matching `skill-profile.module.ts`'s existing location for DartBot data tables.
- No `.ts` file directly under `components/`/`pages/` — not touched by this plan.
- `PopulationPrior` type goes in `app/src/modules/dartbot/types.ts` — no inline `export type` in a `.module.ts` file.
- Every touched runtime `.ts` file needs a covering test (D224) — tests live under `app/tests/`, mirroring `app/src/`'s structure, never colocated.
- No `//`/`/* */` comments inside function bodies — JSDoc above the declaration only.
- Scope is exactly D-E: no `LEVEL_SKILL_TABLE` change, no `fitProfile()`, no level-picker UI (per `docs/superpowers/specs/2026-09-04-d-e-population-prior-design.md` §Non-goals).

---

### Task 1: `PopulationPrior` type + fold module

**Files:**
- Modify: `app/src/modules/dartbot/types.ts` (add `PopulationPrior`)
- Create: `app/src/modules/dartbot/population-prior.module.ts`
- Test: `app/tests/modules/dartbot/population-prior.module.test.ts`

**Interfaces:**
- Consumes: `zoneCentroid(targetNumber, zoneKey)` from `@lib/game/board/board-geometry.module` (returns `BoardPoint | null`); `MissMarginInput` from `@lib/types` (`{ intendedTargetNumber: number | null; intendedZoneKey: DartZoneKey | null; locationX: number | null; locationY: number | null }`).
- Produces: `PopulationPrior` type — `{ sigmaAlongMm: number; sigmaAcrossMm: number; biasXMm: number; biasYMm: number; outlierRate: number; sampleSize: number; excludedCount: number }`. `foldPopulationPrior(rows: readonly MissMarginInput[]): PopulationPrior` — Task 2's script calls this directly.

- [x] **Step 1: Write the failing tests**

```typescript
// app/tests/modules/dartbot/population-prior.module.test.ts
import { describe, expect, it } from "vitest";
import { foldPopulationPrior } from "@modules/dartbot/population-prior.module";
import type { MissMarginInput } from "@lib/types";

function darts(offsets: { dx: number; dy: number }[]): MissMarginInput[] {
  const centre = { x: 0, y: -166 };
  return offsets.map(({ dx, dy }) => ({
    intendedTargetNumber: 20,
    intendedZoneKey: "DOUBLE",
    locationX: centre.x + dx,
    locationY: centre.y + dy,
  }));
}

describe("foldPopulationPrior", () => {
  it("reads bias as the mean offset from each row's own centroid", () => {
    const prior = foldPopulationPrior(
      darts([
        { dx: 4, dy: 2 },
        { dx: 6, dy: 2 },
      ]),
    );
    expect(prior.biasXMm).toBeCloseTo(5);
    expect(prior.biasYMm).toBeCloseTo(2);
  });

  it("reads sigma as the sample stddev around the mean, per axis", () => {
    const prior = foldPopulationPrior(
      darts([
        { dx: -10, dy: 0 },
        { dx: 10, dy: 0 },
        { dx: 0, dy: -5 },
        { dx: 0, dy: 5 },
      ]),
    );
    expect(prior.sigmaAcrossMm).toBeCloseTo(Math.sqrt(200 / 3));
    expect(prior.sigmaAlongMm).toBeCloseTo(Math.sqrt(50 / 3));
  });

  it("counts a row beyond 3-radial-sigma as an outlier", () => {
    const tight = Array.from({ length: 20 }, () => ({ dx: 1, dy: -1 }));
    const outlier = { dx: 500, dy: 500 };
    const prior = foldPopulationPrior(darts([...tight, outlier]));
    expect(prior.outlierRate).toBeCloseTo(1 / 21);
  });

  it("excludes a row with no single centroid or an unset landing point", () => {
    const rows: MissMarginInput[] = [
      {
        intendedTargetNumber: 20,
        intendedZoneKey: "SINGLE",
        locationX: 0,
        locationY: -100,
      },
      {
        intendedTargetNumber: 20,
        intendedZoneKey: "DOUBLE",
        locationX: null,
        locationY: null,
      },
      ...darts([{ dx: 1, dy: 1 }]),
    ];
    const prior = foldPopulationPrior(rows);
    expect(prior.sampleSize).toBe(1);
    expect(prior.excludedCount).toBe(2);
  });

  it("returns a zeroed prior for an empty extract", () => {
    expect(foldPopulationPrior([])).toEqual({
      sigmaAlongMm: 0,
      sigmaAcrossMm: 0,
      biasXMm: 0,
      biasYMm: 0,
      outlierRate: 0,
      sampleSize: 0,
      excludedCount: 0,
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/dartbot/population-prior.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/population-prior.module'`

- [x] **Step 3: Add the type**

Append to `app/src/modules/dartbot/types.ts`:

```typescript
/**
 * The measured population prior D-E (`08-DartBot.md` §Still open) asks for:
 * one pooled scatter, not one per level. `population-prior.module.ts`
 * produces this from a raw dart extract; nothing consumes it yet — it feeds
 * `fitProfile()` (phase 10), unbuilt.
 */
export type PopulationPrior = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
  sampleSize: number;
  excludedCount: number;
};
```

- [x] **Step 4: Write the module**

```typescript
// app/src/modules/dartbot/population-prior.module.ts
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { MissMarginInput } from "@lib/types";
import type { PopulationPrior } from "./types";

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleStdDev(values: readonly number[], center: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - center) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * D-E's fold (`08-DartBot.md` §Still open): pools every row into one
 * population-level scatter around each row's own declared-target centroid —
 * `across` is the board's raw x-axis and `along` its raw y-axis, matching
 * `throw-engine.module.ts`'s unrotated local frame (`covarianceRotationDegrees`
 * is 0 for every hand-set level today, so bias and scatter apply in board
 * coordinates directly rather than per-target-rotated ones). A row is
 * excluded when `zoneCentroid()` has no single centre to measure from (bare
 * `SINGLE`, `MISS`) or its landing point is unset — the same exclusions
 * `missMargin()` applies, reused here rather than reimplemented.
 *
 * `outlierRate` is the fraction landing beyond 3 population-radial-sigma
 * (`sqrt(sigmaAlong² + sigmaAcross²)`) from its own centroid — the closest
 * single-number reading of the doc's "tail beyond 3σ" for a scatter with two
 * different axis widths.
 */
export function foldPopulationPrior(
  rows: readonly MissMarginInput[],
): PopulationPrior {
  const offsets: { dx: number; dy: number }[] = [];
  let excludedCount = 0;

  for (const row of rows) {
    const centre = zoneCentroid(row.intendedTargetNumber, row.intendedZoneKey);
    if (centre === null || row.locationX === null || row.locationY === null) {
      excludedCount++;
      continue;
    }
    offsets.push({ dx: row.locationX - centre.x, dy: row.locationY - centre.y });
  }

  if (offsets.length === 0) {
    return {
      sigmaAlongMm: 0,
      sigmaAcrossMm: 0,
      biasXMm: 0,
      biasYMm: 0,
      outlierRate: 0,
      sampleSize: 0,
      excludedCount,
    };
  }

  const biasXMm = mean(offsets.map((o) => o.dx));
  const biasYMm = mean(offsets.map((o) => o.dy));
  const sigmaAcrossMm = sampleStdDev(offsets.map((o) => o.dx), biasXMm);
  const sigmaAlongMm = sampleStdDev(offsets.map((o) => o.dy), biasYMm);
  const sigmaRadialMm = Math.sqrt(sigmaAlongMm ** 2 + sigmaAcrossMm ** 2);

  const outlierCount = offsets.filter(
    (o) => Math.sqrt(o.dx ** 2 + o.dy ** 2) > 3 * sigmaRadialMm,
  ).length;

  return {
    sigmaAlongMm,
    sigmaAcrossMm,
    biasXMm,
    biasYMm,
    outlierRate: outlierCount / offsets.length,
    sampleSize: offsets.length,
    excludedCount,
  };
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/dartbot/population-prior.module.test.ts`
Expected: PASS (5 tests)

- [x] **Step 6: Commit**

```bash
git add app/src/modules/dartbot/types.ts app/src/modules/dartbot/population-prior.module.ts app/tests/modules/dartbot/population-prior.module.test.ts
git commit -m "feat: fold dart rows into a D-E population prior"
```

---

### Task 2: extract-reading script

**Files:**
- Create: `app/scripts/dartbot-population-prior.ts`
- Test: `app/tests/scripts/dartbot-population-prior.test.ts`

**Interfaces:**
- Consumes: `foldPopulationPrior` + `PopulationPrior` from Task 1 (`@modules/dartbot/population-prior.module`, `./types`); `MissMarginInput` from `@lib/types`.
- Produces: `extractRowsFromMarkdown(markdown: string): ExtractRow[]` and `toMissMarginInputs(rows: readonly ExtractRow[]): MissMarginInput[]`, both exported for the test; a `main()` invoked only when run directly.

- [x] **Step 1: Write the failing tests**

```typescript
// app/tests/scripts/dartbot-population-prior.test.ts
import { describe, expect, it } from "vitest";
import {
  extractRowsFromMarkdown,
  toMissMarginInputs,
} from "../../scripts/dartbot-population-prior";

const markdown = `# Extracted data

\`\`\`sql
SELECT d.intended_target_number, d.intended_zone_id, d.location_x, d.location_y
FROM darts d;
\`\`\`

**Result:**

\`\`\`json
[
  { "intended_target_number": 20, "intended_zone_id": 4, "location_x": "1.5", "location_y": "-2.5" }
]
\`\`\`

\`\`\`sql
SELECT d.intended_target_number, dz.implementation_key AS intended_zone_key, d.location_x, d.location_y
FROM darts d JOIN dart_zones dz ON dz.id = d.intended_zone_id;
\`\`\`

**Result:**

\`\`\`json
[
  { "intended_target_number": 20, "intended_zone_key": "DOUBLE", "location_x": "1.5", "location_y": "-2.5" },
  { "intended_target_number": null, "intended_zone_key": null, "location_x": null, "location_y": null }
]
\`\`\`
`;

describe("extractRowsFromMarkdown", () => {
  it("reads the last fenced json block, skipping the raw zone_id block", () => {
    const rows = extractRowsFromMarkdown(markdown);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.intended_zone_key).toBe("DOUBLE");
  });

  it("throws when the file has no json block", () => {
    expect(() => extractRowsFromMarkdown("# no code fences here")).toThrow(
      "No ```json block found",
    );
  });
});

describe("toMissMarginInputs", () => {
  it("camel-cases fields and coerces stringly numeric locations", () => {
    const [row] = toMissMarginInputs(extractRowsFromMarkdown(markdown));
    expect(row).toEqual({
      intendedTargetNumber: 20,
      intendedZoneKey: "DOUBLE",
      locationX: 1.5,
      locationY: -2.5,
    });
  });

  it("keeps a null location null rather than coercing it to zero", () => {
    const [, secondRow] = toMissMarginInputs(extractRowsFromMarkdown(markdown));
    expect(secondRow).toEqual({
      intendedTargetNumber: null,
      intendedZoneKey: null,
      locationX: null,
      locationY: null,
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/scripts/dartbot-population-prior.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/dartbot-population-prior'`

- [x] **Step 3: Write the script**

```typescript
// app/scripts/dartbot-population-prior.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { foldPopulationPrior } from "../src/modules/dartbot/population-prior.module";
import type { MissMarginInput } from "../src/lib/types";

type ExtractRow = {
  intended_target_number: number | null;
  intended_zone_key: string | null;
  location_x: number | string | null;
  location_y: number | string | null;
};

/**
 * D-E's fold (`08-DartBot.md` §Still open) runs offline against a human-run
 * SQL extract, never against a live database — see the module this delegates
 * to for the aggregation itself. Reads the last fenced ```json block in a
 * Markdown extract file (the doc's query joins `dart_zones` for a readable
 * `intended_zone_key`; an earlier block carrying the raw numeric
 * `intended_zone_id` instead is not usable here and is skipped by taking the
 * last block rather than the first).
 */
export function extractRowsFromMarkdown(markdown: string): ExtractRow[] {
  const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)```/g)];
  const last = blocks.at(-1);
  if (!last) {
    throw new Error("No ```json block found in the extract file");
  }
  return JSON.parse(last[1]) as ExtractRow[];
}

export function toMissMarginInputs(
  rows: readonly ExtractRow[],
): MissMarginInput[] {
  return rows.map((row) => ({
    intendedTargetNumber: row.intended_target_number,
    intendedZoneKey:
      row.intended_zone_key as MissMarginInput["intendedZoneKey"],
    locationX: row.location_x === null ? null : Number(row.location_x),
    locationY: row.location_y === null ? null : Number(row.location_y),
  }));
}

function main(): void {
  const path =
    process.argv[2] ??
    fileURLToPath(new URL("../../D-E-extract.md", import.meta.url));
  const markdown = readFileSync(path, "utf8");
  const rows = toMissMarginInputs(extractRowsFromMarkdown(markdown));
  const prior = foldPopulationPrior(rows);
  console.log(JSON.stringify(prior, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/scripts/dartbot-population-prior.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Run the script against the real extract**

Run: `cd app && npx tsx scripts/dartbot-population-prior.ts`
Expected output (328-row extract, 0 excluded):

```json
{
  "sigmaAlongMm": 27.52742810002189,
  "sigmaAcrossMm": 20.124980272859517,
  "biasXMm": -5.003369683477989,
  "biasYMm": 3.1375575810935215,
  "outlierRate": 0.003048780487804878,
  "sampleSize": 328,
  "excludedCount": 0
}
```

- [x] **Step 6: Commit**

```bash
git add app/scripts/dartbot-population-prior.ts app/tests/scripts/dartbot-population-prior.test.ts
git commit -m "feat: add D-E population-prior extract script"
```

---

### Task 3: Close D-E in `08-DartBot.md`

**Files:**
- Modify: `docs/architecture/08-DartBot.md`

**Interfaces:**
- Consumes: the measured `PopulationPrior` values from Task 2, Step 5.
- Produces: nothing consumed by later tasks — this is the plan's terminal step.

- [ ] **Step 1: Move D-E out of "Still open" into the resolved table**

In `docs/architecture/08-DartBot.md`, the "Resolved by the seat-admission design" table (around line 701-709) lists `D-C` through `D-J`. Add a row for `D-E` there (or a small adjacent table if the existing one's "resolved by the seat-admission design" framing doesn't fit — D-E was resolved by this fold, not that design) stating:

- The extract ran (`D-E-extract.md`, 328 `PLAYER`-only rows, filtered `participant_type_id = 1`).
- The measured prior: `sigmaAlongMm ≈ 27.5`, `sigmaAcrossMm ≈ 20.1`, `biasXMm ≈ -5.0`, `biasYMm ≈ 3.1`, `outlierRate ≈ 0.3%`.
- The caveat: the sample is thin (328 darts) and its `intended_zone_key` composition is almost entirely `DOUBLE`/`INNER_BULL` — not a cross-section of every zone a player throws at.
- What's still not done: `LEVEL_SKILL_TABLE` is not refit against this prior, and `fitProfile()` (phase 10) is not built — this number is stored, not yet consumed.

Remove the `**D-E — Population prior values.**` paragraph and its SQL block from the "Still open" section (lines ~713-736), leaving only `D-K` there. Update the "Two, both blocked on the same thing" lead-in to read correctly for one remaining open item instead of two.

- [ ] **Step 2: Run the doc-integrity gates**

Run: `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-decision-ids.sh`
Expected: all `OK`

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/08-DartBot.md
git commit -m "docs: close D-E with the measured population prior"
```

---

## Self-Review

**Spec coverage:** Task 1 covers the module + type (spec §Components, §Algorithm). Task 2 covers the script (spec §Components, includes the "last JSON block" nuance from spec §Components). Task 3 covers recording the result and closing D-E (spec §Output). Spec §Non-goals is respected — no task touches `LEVEL_SKILL_TABLE`, `fitProfile()`, or the picker UI.

**Placeholder scan:** none found — every step has complete code or an exact command + expected output.

**Type consistency:** `PopulationPrior` (Task 1) is used identically in Task 2's `foldPopulationPrior` call and Task 3's numbers. `MissMarginInput` is imported the same way (`@lib/types` in tests, relative `../src/lib/types` in the script) in both tasks, matching the existing repo convention of path aliases inside `app/src`/`app/tests` and relative specifiers inside `app/scripts` (see `generate-app-icons.ts`'s own relative imports).

**Status note:** Tasks 1 and 2 were already implemented and verified green before this plan was written (the process gap that prompted writing this plan retroactively) — their steps are checked off as executed, and Step 5/6 of each were run against the real repo state, not simulated. Task 3 is the one step still to execute.
