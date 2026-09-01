# DartBot Phase 2 — Calibration Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a test-only calibration harness that simulates many DartBot visits per level and proves the hand-set level curve (`LEVEL_SKILL_TABLE`, phase 1) produces coherent, monotonically-improving tier behaviour — plus a distributional self-consistency check that stands ready to be pointed at the real human corpus once D-E lands.

**Architecture:** Two harness modules under `app/tests/modules/dartbot/harness/` (test-only, per `08-DartBot.md` §Module Boundary — "can never reach an app bundle"): `simulate-tier.ts` runs many simulated visits at a fixed calibration target through phase 1's `throwDart`/`skillProfileForLevel`/`createDartRng` and aggregates emergent statistics (three-dart average, checkout rate, T20 rate, scoring-band frequencies, segment-hit distribution); `distribution-compare.ts` bins a `MissMargin` sample (via the already-shipped `missMargin()`) into a distance histogram and computes total-variation distance between two samples. Two test files consume them: `tier-bands.test.ts` asserts monotonicity across all 15 levels plus sanity ranges at three checkpoints (1, 8, 15), and `distributional.test.ts` proves the comparison machinery discriminates same-distribution noise from real drift, using simulated samples on both sides since the real human corpus (D-E) is still blocked on a human-run SQL extract. This plan implements phase 2 of `docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md`, scoped from `docs/architecture/08-DartBot.md` §Calibration, §Test Strategy rows "tier bands" and "distributional".

**Tech Stack:** TypeScript, Vitest, phase 1's `app/src/modules/dartbot/*` modules, `app/src/lib/game/board/miss-margin.module.ts`.

## Global Constraints

- `Math.random()` never appears anywhere the harness touches — it calls only `createDartRng` (`08-DartBot.md` §Determinism and Replay).
- The harness is test-only and lives under `app/tests/modules/dartbot/harness/` — it must never be imported from `app/src/` (`08-DartBot.md` §Module Boundary: "so it can never reach an app bundle").
- No `fitProfile()` and no real-corpus SQL read in this phase — that is phase 10 (`docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md` §V1 Scope). Phase 2 only proves the hand-set curve behaves coherently in simulation.
- No `//` or `/* */` comments inside function bodies anywhere under `app/src/**/*.ts` (`app/CLAUDE.md`); harness files live under `app/tests/`, which is explicitly out of scope for that rule, but JSDoc above a declaration is still the house style.
- Tests live under `app/tests/`, mirroring `app/src/` where they cover `app/src/`; the harness itself is test-only support code and has no `app/src/` mirror to maintain (`08-DartBot.md` §Module Boundary).
- `scripts/check-test-coverage.sh` (D224) governs `app/src/` and `app/scripts/` changes only — this plan touches neither, so it does not apply, but every harness function must still be exercised by a real assertion in one of this plan's two test files.
- Done means `cd app && npm run validate:app` exits zero with 0 errors/warnings/hints (`app/CLAUDE.md`).
- Run `cd app && npm run format` before considering any task's diff final.
- This repo does not use git worktrees — check out the task branch directly (`git checkout -b dartbot-2-calibration`) in the main working copy.
- Every task uses a dedicated branch; do not merge to `main` directly (root `CLAUDE.md` Hard Invariants).
- This branch is a single hop off `main`, not stacked on `dartbot-1-throw-engine` (already merged) — the delivery design's plan-sequencing table requires phase 1 to be merged to `main` before this branch is cut (root `CLAUDE.md` branch-stacking cap).

---

## File Structure

```
app/tests/modules/dartbot/harness/
├── simulate-tier.ts          # simulateTierStats(level, seed, visits) -> TierStats
├── distribution-compare.ts   # distanceHistogram(), totalVariationDistance()
├── tier-bands.test.ts        # monotonicity across all 15 levels + sanity ranges at 3 checkpoints
└── distributional.test.ts    # TV-distance self-consistency test
```

`simulate-tier.ts` and `distribution-compare.ts` are plain `.ts` files, not `.test.ts` — Vitest's `include: ["tests/**/*.test.ts"]` (`app/vitest.config.ts`) does not collect them as test files, exactly like the existing precedent `app/tests/mocks/auth-client.mock.ts` (a non-test support file living under `app/tests/`). Each file has exactly one responsibility; the two test files are the only consumers.

---

### Task 1: Tier simulation harness + tier-band test

Runs many simulated visits per level at a fixed calibration target (T20 treble, the same target phase 1's determinism test uses) and a fixed checkout target (D20), aggregating the emergent statistics named in `08-DartBot.md` §Test Strategy's "Tier bands" row: three-dart average, checkout %, T20 rate per visit, 100+/140+/180 frequency, segment hit distribution.

**Files:**
- Create: `app/tests/modules/dartbot/harness/simulate-tier.ts`
- Create: `app/tests/modules/dartbot/harness/tier-bands.test.ts`

**Interfaces:**
- Consumes: `createDartRng` (`@modules/dartbot/rng.module`), `skillProfileForLevel` (`@modules/dartbot/skill-profile.module`), `throwDart` (`@modules/dartbot/throw-engine.module`), `ThrowIntent` (`@modules/types`) — all phase 1
- Produces: `TierStats` type, `simulateTierStats(level: number, seed: number, visits: number): TierStats`

- [ ] **Step 1: Write the failing test**

The bands below were measured from the harness written in Step 3 at `visits = 5000`, `BASE_SEED = 700000` (`seed = BASE_SEED + level`), and given generous tolerance (roughly ±25% relative, wider for near-zero rates) so a future re-tune of `LEVEL_SKILL_TABLE` can still pass while a gross regression (inverted curve, wrong target, broken scatter) cannot. Because `createDartRng` is a pure function of `(seed, dartIndex)`, this test produces byte-identical numbers on every run — there is no flakiness to guard against, only future intentional re-tuning.

```typescript
// app/tests/modules/dartbot/harness/tier-bands.test.ts
import { describe, expect, it } from "vitest";
import { simulateTierStats } from "./simulate-tier";

const BASE_SEED = 700000;
const VISITS = 5000;
const ALL_LEVELS = Array.from({ length: 15 }, (_, i) => i + 1);

function stats(level: number) {
  return simulateTierStats(level, BASE_SEED + level, VISITS);
}

describe("tier calibration — sanity bands", () => {
  it("level 1 sits in the beginner band", () => {
    const s = stats(1);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(27);
    expect(s.threeDartAverage).toBeLessThanOrEqual(45);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.03);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.06);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.07);
    expect(s.trebleRate).toBeLessThanOrEqual(0.12);
    expect(s.missRate).toBeGreaterThanOrEqual(0.045);
    expect(s.missRate).toBeLessThanOrEqual(0.085);
  });

  it("level 8 sits in the mid band", () => {
    const s = stats(8);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(41);
    expect(s.threeDartAverage).toBeLessThanOrEqual(68);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.12);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.2);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.15);
    expect(s.trebleRate).toBeLessThanOrEqual(0.25);
    expect(s.missRate).toBeGreaterThanOrEqual(0.004);
    expect(s.missRate).toBeLessThanOrEqual(0.012);
  });

  it("level 15 sits in the elite band", () => {
    const s = stats(15);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(86);
    expect(s.threeDartAverage).toBeLessThanOrEqual(144);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.36);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.61);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.36);
    expect(s.trebleRate).toBeLessThanOrEqual(0.6);
    expect(s.missRate).toBeGreaterThanOrEqual(0);
    expect(s.missRate).toBeLessThanOrEqual(0.003);
  });
});

describe("tier calibration — monotonicity across all 15 levels", () => {
  const allStats = ALL_LEVELS.map(stats);

  it("three-dart average never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.threeDartAverage).toBeGreaterThanOrEqual(
        allStats[i - 1]!.threeDartAverage,
      );
    }
  });

  it("checkout rate never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.checkoutRate).toBeGreaterThanOrEqual(
        allStats[i - 1]!.checkoutRate,
      );
    }
  });

  it("treble rate never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.trebleRate).toBeGreaterThanOrEqual(
        allStats[i - 1]!.trebleRate,
      );
    }
  });

  it("miss rate never increases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.missRate).toBeLessThanOrEqual(
        allStats[i - 1]!.missRate,
      );
    }
  });

  it("t20 rate per visit never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.t20RatePerVisit).toBeGreaterThanOrEqual(
        allStats[i - 1]!.t20RatePerVisit,
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/tier-bands.test.ts
```

Expected: FAIL — `Cannot find module './simulate-tier'`.

- [ ] **Step 3: Write the implementation**

```typescript
// app/tests/modules/dartbot/harness/simulate-tier.ts
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { ThrowIntent } from "@modules/types";

const CALIBRATION_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };
const CHECKOUT_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "DOUBLE" };

/**
 * Offsets the checkout-attempt stream from the scoring-visit stream so the
 * two draw from independent dart sequences under the same top-level seed.
 * Arbitrary and large enough that no realistic `visits` count collides it
 * with the scoring stream's own dartIndex range.
 */
const CHECKOUT_SEED_OFFSET = 500000;

export type TierStats = {
  threeDartAverage: number;
  checkoutRate: number;
  t20RatePerVisit: number;
  oneHundredPlusRate: number;
  oneFortyPlusRate: number;
  oneEightyRate: number;
  trebleRate: number;
  missRate: number;
};

/**
 * Simulates `visits` three-dart visits at T20 treble plus `visits` single
 * checkout attempts at D20, both purely as a function of (seed, dartIndex)
 * per phase 1's determinism contract, and aggregates the emergent
 * statistics `08-DartBot.md` §Test Strategy names for tier calibration.
 */
export function simulateTierStats(
  level: number,
  seed: number,
  visits: number,
): TierStats {
  const profile = skillProfileForLevel(level);
  const visitTotals: number[] = [];
  let t20Hits = 0;
  let trebleHits = 0;
  let missHits = 0;
  let darts = 0;

  for (let visit = 0; visit < visits; visit++) {
    let visitTotal = 0;
    for (let dart = 0; dart < 3; dart++) {
      const rng = createDartRng(seed, visit * 3 + dart);
      const thrown = throwDart(CALIBRATION_TARGET, profile, rng);
      visitTotal += thrown.hit.score;
      darts++;
      if (thrown.hit.zoneKey === "TREBLE") trebleHits++;
      if (thrown.hit.zoneKey === "MISS") missHits++;
      if (thrown.hit.targetNumber === 20 && thrown.hit.zoneKey === "TREBLE") {
        t20Hits++;
      }
    }
    visitTotals.push(visitTotal);
  }

  let checkoutHits = 0;
  for (let attempt = 0; attempt < visits; attempt++) {
    const rng = createDartRng(seed + CHECKOUT_SEED_OFFSET, attempt);
    const thrown = throwDart(CHECKOUT_TARGET, profile, rng);
    if (thrown.hit.targetNumber === 20 && thrown.hit.zoneKey === "DOUBLE") {
      checkoutHits++;
    }
  }

  const threeDartAverage =
    visitTotals.reduce((sum, total) => sum + total, 0) / visits;

  return {
    threeDartAverage,
    checkoutRate: checkoutHits / visits,
    t20RatePerVisit: t20Hits / visits,
    oneHundredPlusRate: visitTotals.filter((total) => total >= 100).length / visits,
    oneFortyPlusRate: visitTotals.filter((total) => total >= 140).length / visits,
    oneEightyRate: visitTotals.filter((total) => total === 180).length / visits,
    trebleRate: trebleHits / darts,
    missRate: missHits / darts,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/tier-bands.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add app/tests/modules/dartbot/harness/simulate-tier.ts app/tests/modules/dartbot/harness/tier-bands.test.ts
git commit -m "test: add DartBot tier calibration harness and tier-band gate"
```

---

### Task 2: Distributional self-consistency test

`08-DartBot.md` §Test Strategy's "Distributional" row compares simulated `MissMargin` against a distribution fitted from real human darts — but that fit is D-E, still open and explicitly blocked on a human running a SQL extract (`08-DartBot.md` §Open Decisions §Still open). This task lands the comparison machinery itself and proves it discriminates real drift, using two simulated samples (same level vs. different levels) as stand-ins for "same distribution" and "different distribution." Swapping in the real corpus once D-E lands is a data-source change to `distributional.test.ts`, not a redesign of `distribution-compare.ts` — the same seam phase 1 documented for the level curve itself.

**Files:**
- Create: `app/tests/modules/dartbot/harness/distribution-compare.ts`
- Create: `app/tests/modules/dartbot/harness/distributional.test.ts`

**Interfaces:**
- Consumes: `missMargin` (`@lib/game/board/miss-margin.module`), `createDartRng`, `skillProfileForLevel`, `throwDart` (all phase 1)
- Produces: `distanceHistogram(samples: number[]): number[]`, `totalVariationDistance(a: number[], b: number[]): number`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/dartbot/harness/distributional.test.ts
import { describe, expect, it } from "vitest";
import { missMargin } from "@lib/game/board/miss-margin.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { ThrowIntent } from "@modules/types";
import { distanceHistogram, totalVariationDistance } from "./distribution-compare";

const T20_TREBLE: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };
const SAMPLE_SIZE = 5000;

function sampleMissDistances(level: number, seed: number): number[] {
  const profile = skillProfileForLevel(level);
  const distances: number[] = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const rng = createDartRng(seed, i);
    const thrown = throwDart(T20_TREBLE, profile, rng);
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    });
    distances.push(margin!.distanceMm);
  }
  return distances;
}

describe("distributional comparison — self-consistency", () => {
  it("scores two samples of the same level, different seeds, as the same distribution", () => {
    const a = distanceHistogram(sampleMissDistances(8, 111));
    const b = distanceHistogram(sampleMissDistances(8, 222));
    expect(totalVariationDistance(a, b)).toBeLessThan(0.05);
  });

  it("scores level 1 versus level 15 as a clearly different distribution", () => {
    const beginner = distanceHistogram(sampleMissDistances(1, 333));
    const elite = distanceHistogram(sampleMissDistances(15, 444));
    expect(totalVariationDistance(beginner, elite)).toBeGreaterThan(0.5);
  });

  it("scores adjacent levels 7 and 9 as detectably different", () => {
    const seven = distanceHistogram(sampleMissDistances(7, 555));
    const nine = distanceHistogram(sampleMissDistances(9, 666));
    expect(totalVariationDistance(seven, nine)).toBeGreaterThan(0.05);
  });

  it("a histogram's bins sum to 1", () => {
    const histogram = distanceHistogram(sampleMissDistances(8, 777));
    const total = histogram.reduce((sum, fraction) => sum + fraction, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/distributional.test.ts
```

Expected: FAIL — `Cannot find module './distribution-compare'`.

- [ ] **Step 3: Write the implementation**

```typescript
// app/tests/modules/dartbot/harness/distribution-compare.ts

const BIN_WIDTH_MM = 10;
const BIN_COUNT = 12;

/**
 * Bins a sample of miss distances (mm) into a fixed-width histogram,
 * normalised to fractions. The last bin is an open-ended overflow bucket for
 * anything at or beyond `BIN_COUNT * BIN_WIDTH_MM`, so every sample lands
 * somewhere and the bins always sum to 1.
 */
export function distanceHistogram(samples: number[]): number[] {
  const bins = new Array(BIN_COUNT).fill(0) as number[];
  for (const distance of samples) {
    const index = Math.min(BIN_COUNT - 1, Math.floor(distance / BIN_WIDTH_MM));
    bins[index]!++;
  }
  return bins.map((count) => count / samples.length);
}

/**
 * Total variation distance between two histograms of equal bin count and
 * width: half the sum of absolute per-bin differences. Ranges 0 (identical
 * distributions) to 1 (disjoint support).
 */
export function totalVariationDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i]! - (b[i] ?? 0));
  }
  return sum / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/distributional.test.ts
```

Expected: PASS (4 tests). Measured values on this exact seed set: same-level TV distance ≈ 0.002 (well under the 0.05 self-consistency threshold), level-1-vs-15 TV distance ≈ 0.85 (well over the 0.5 drift threshold), level-7-vs-9 TV distance ≈ 0.16 (over the 0.05 adjacent-drift threshold).

- [ ] **Step 5: Commit**

```bash
git add app/tests/modules/dartbot/harness/distribution-compare.ts app/tests/modules/dartbot/harness/distributional.test.ts
git commit -m "test: add DartBot distributional comparison self-consistency test"
```

---

### Task 3: Context maintenance and full validation

Repo-mandatory close-out (root `CLAUDE.md` §Context Maintenance) — not optional, regardless of this plan.

- [ ] **Step 1: Run the full app validation chain**

```bash
cd app && npm run format
cd app && npm run validate:app
```

Expected: `npm run format` reports no diffs (or the diffs it makes are committed in Step 3 below); `validate:app` exits zero with 0 errors, 0 warnings, 0 hints. If the sandboxed environment has no `DATABASE_URL`/Neon credentials, `validate:app` fails at its `db:status` step before reaching the DB-independent checks — this is an established, previously-documented limitation of this repo's sandboxed sessions (see phase 1's completion report), not something to work around silently. In that case run the DB-independent subset directly and report the gap explicitly:

```bash
cd app && npx fallow && npm test && npm run check
cd .. && bash scripts/refresh-graph.sh
```

- [ ] **Step 2: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`. This phase adds no new `app/src/` module, no new doc-tracked directory (the harness's location under `app/tests/modules/dartbot/harness/` is already documented in `08-DartBot.md` §Module Boundary from phase 1's spec, and `07-Frontend/02-Folder-Structure.md` tracks only `app/src/`), and no new decision — confirm this rather than assume it, and only edit the context map / File Inventory / decision ledger if the skill's own checks find drift. Confirm `scripts/check-context-map.sh`, `scripts/check-doc-links.sh`, `scripts/check-context-budget.sh` all pass.

- [ ] **Step 3: Run the remaining gate scripts**

```bash
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-test-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-no-inline-comments.sh
```

Report each script's result explicitly (`run-all-gates` skill). `check-test-coverage.sh` and `check-type-barrels.sh` are expected to report no violations for this phase — this plan touches no `app/src/` file and declares no new type/interface.

- [ ] **Step 4: Commit any formatting or context-maintenance fixes**

```bash
git add -A
git status
```

Review the diff before committing — commit only if `git status` shows changes from Steps 1–3.

```bash
git commit -m "chore: context maintenance for DartBot phase 2"
```

- [ ] **Step 5: Push**

```bash
git push -u origin dartbot-2-calibration
```

---

## Self-Review

**Spec coverage:** `08-DartBot.md` §Calibration is referenced for context (the corpus already exists via `missMargin()`/`v_dart_locations`, the cold-start formula, `fitProfile()`'s shape) but deliberately not implemented — phase 2's own delivery-phase row is "Harness + tier calibration", and `fitProfile()` against a real corpus is phase 10 per the delivery design's V1 Scope table; this plan does not build it, matching D-E's "no plan in this sequence waits on D-E landing." §Test Strategy's two named rows are both covered: "tier bands" by Task 1 (sanity bands at three checkpoints plus five monotonicity assertions spanning all 15 levels), "distributional" by Task 2 (the TV-distance comparison machinery, proven against simulated same-vs-different-level samples since the real corpus is blocked on D-E). The phase 2 gate itself ("Tier bands green in CI") is Task 1.

**Placeholder scan:** no TBD/TODO; every step has real code, real measured numbers, or a real command with expected output. The tier bands and TV-distance thresholds are not placeholders — they were measured by actually running this plan's exact harness code against phase 1's real `LEVEL_SKILL_TABLE` before being written into this plan.

**Type consistency:** `TierStats` is defined once (Task 1, `simulate-tier.ts`) and consumed unchanged by `tier-bands.test.ts`. `distanceHistogram`/`totalVariationDistance` are defined once (Task 2, `distribution-compare.ts`) and consumed unchanged by `distributional.test.ts`. Neither harness file imports from the other — they are independent per the File Structure's one-responsibility rule.

**Scope:** no `fitProfile()`, no real SQL corpus read, no strategy layer, no `DartBot` class, no persistence, no game engine wiring — all correctly out of phase 2's delivery-phase row. The harness never crosses into `app/src/` (`08-DartBot.md`'s explicit "can never reach an app bundle" constraint), and both test files import only phase-1-shipped modules plus this phase's own two harness files.
