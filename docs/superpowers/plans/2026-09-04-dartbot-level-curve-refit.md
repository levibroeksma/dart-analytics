# DartBot Level-Curve Refit (D-L) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refit `LEVEL_SKILL_TABLE` (`app/src/modules/dartbot/skill-profile.module.ts`) against the D-E measured population prior — anchor level 6 to the D-E values exactly, power-law-rescale every other level from its pre-refit ratio to level 6, with the exponent `p` chosen by real simulation so level 1's three-dart average lands in 26–31. Add the new append-only `docs/architecture/08-DartBot-Anchor-Log.md`, and close out D-L in `08-DartBot.md`.

**Spec:** `docs/superpowers/specs/2026-09-04-dartbot-level-curve-refit-design.md` (governs; do not rewrite).

**Non-goals (unchanged from spec):** `fitProfile()` (phase 10), D-K (auto level), the level-picker average/checkout UI, `decisionQuality`/`bedOffsetMm`/`bounceOutRate`/`deflectionRadiusMm`/`covarianceRotationDegrees`, `DEFAULT_BOT_LEVEL`.

**Tech Stack:** TypeScript, Vitest, tsx (one-off script runner).

## Global Constraints

- Branch: `claude/dartbot-level-select-stats-23x2l0`. Every commit is a real commit; never amend, never force-push.
- TDD mandatory: red → green → refactor for every code change (`app/CLAUDE.md`).
- D224: a runtime `.ts` edit under `app/src/` or `app/scripts/` with no accompanying test edit fails `scripts/check-test-coverage.sh` — every code task below touches its own test in the same commit.
- D255: comments in `app/src/**/*.ts` document the declaration's contract only — cite `(D-L, \`08-DartBot.md\`)` parenthetically, never narrate the refit's history in prose.
- No fabricated numbers: `p` and the per-level table are whatever the script in Task 1 actually prints when run in Task 2 — later tasks quote its real output, not invented values. Same for the tier-band bounds in Task 4 — quote what `vitest` actually reports post-refit.
- Minimal diffs; specs under `docs/superpowers/specs/**` are never rewritten (`docs/CLAUDE.md`).
- `npm run format` / `npm run format:check` clean before considering any task done.
- `npm run validate:app` must exit 0 with 0 errors/0 warnings/0 hints before the overall task is done.
- Context Maintenance (root `CLAUDE.md`) mandatory before claiming done — final task runs the `context-maintenance` skill.

---

### Task 1: Write the refit script's pure logic (`rescaleLevel`)

**Files:**
- Create: `app/scripts/dartbot-level-curve-refit.ts`
- Create: `app/tests/scripts/dartbot-level-curve-refit.test.ts`

**Interfaces:**
- Produces: `CurveFields = { sigmaAlongMm: number; sigmaAcrossMm: number; biasXMm: number; biasYMm: number; outlierRate: number }` and `rescaleLevel(currentLevel: CurveFields, currentAnchor: CurveFields, anchorValues: CurveFields, p: number): CurveFields`, exported from `app/scripts/dartbot-level-curve-refit.ts`.

`rescaleLevel` computes, per field: `sigmaAlongMm`/`sigmaAcrossMm`/`outlierRate` as `anchorValues.field × (currentLevel.field / currentAnchor.field) ** p`; bias as a magnitude rescale of the same shape (`anchorMag × (currentMag / currentAnchorMag) ** p`) applied along `currentLevel`'s own bias direction (unit vector), never the anchor's direction. Zero bias magnitude stays zero (no direction to preserve).

- [ ] **Step 1: Write the failing test**

Create `app/tests/scripts/dartbot-level-curve-refit.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { rescaleLevel } from "../../scripts/dartbot-level-curve-refit";

const anchor = {
  sigmaAlongMm: 20,
  sigmaAcrossMm: 20,
  biasXMm: 3,
  biasYMm: 4,
  outlierRate: 0.05,
};
const weak = {
  sigmaAlongMm: 40,
  sigmaAcrossMm: 40,
  biasXMm: 6,
  biasYMm: 8,
  outlierRate: 0.1,
};
const measured = {
  sigmaAlongMm: 10,
  sigmaAcrossMm: 10,
  biasXMm: -1,
  biasYMm: 2,
  outlierRate: 0.01,
};

describe("rescaleLevel", () => {
  it("returns the anchor values exactly when the level is its own anchor, for any p", () => {
    expect(rescaleLevel(anchor, anchor, measured, 1)).toEqual(measured);
    expect(rescaleLevel(anchor, anchor, measured, 3.7)).toEqual(measured);
  });

  it("rescales sigma and outlier proportionally at p = 1", () => {
    const result = rescaleLevel(weak, anchor, measured, 1);
    // ratio = weak/anchor = 2 for every scalar field here
    expect(result.sigmaAlongMm).toBeCloseTo(20, 5);
    expect(result.sigmaAcrossMm).toBeCloseTo(20, 5);
    expect(result.outlierRate).toBeCloseTo(0.02, 5);
    // bias magnitude: anchorMag(measured) = sqrt(1+4) ≈ 2.2360679..., × ratio 2
    // direction: weak's own unit vector (0.6, 0.8)
    expect(result.biasXMm).toBeCloseTo(2.68328157, 5);
    expect(result.biasYMm).toBeCloseTo(3.57770876, 5);
  });

  it("widens the gap beyond proportional when p > 1", () => {
    const result = rescaleLevel(weak, anchor, measured, 2);
    // ratio^2 = 4
    expect(result.sigmaAlongMm).toBeCloseTo(40, 5);
    expect(result.outlierRate).toBeCloseTo(0.04, 5);
    expect(result.biasXMm).toBeCloseTo(5.36656315, 5);
    expect(result.biasYMm).toBeCloseTo(7.15541753, 5);
  });

  it("keeps zero bias magnitude at zero regardless of p", () => {
    const zeroBias = { ...weak, biasXMm: 0, biasYMm: 0 };
    const result = rescaleLevel(zeroBias, anchor, measured, 2);
    expect(result.biasXMm).toBe(0);
    expect(result.biasYMm).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/scripts/dartbot-level-curve-refit.test.ts`
Expected: FAIL — `../../scripts/dartbot-level-curve-refit` does not exist / `rescaleLevel` not exported.

- [ ] **Step 3: Implement the script**

Create `app/scripts/dartbot-level-curve-refit.ts`:

```typescript
import { fileURLToPath } from "node:url";
import { LEVEL_SKILL_TABLE } from "../src/modules/dartbot/skill-profile.module";
import type { SkillProfile } from "../src/modules/dartbot/types";
import { simulateTierStats } from "../tests/modules/dartbot/harness/simulate-tier";

export type CurveFields = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
};

const ANCHOR_LEVEL = 6;
const D_E_ANCHOR: CurveFields = {
  sigmaAlongMm: 27.5,
  sigmaAcrossMm: 20.1,
  biasXMm: -5.0,
  biasYMm: 3.1,
  outlierRate: 0.003,
};
const LEVEL_1_TARGET_MIN = 26;
const LEVEL_1_TARGET_MAX = 31;
const SEARCH_SEED = 900000;
const SEARCH_VISITS = 20000;
const SEARCH_ITERATIONS = 40;

export function rescaleLevel(
  currentLevel: CurveFields,
  currentAnchor: CurveFields,
  anchorValues: CurveFields,
  p: number,
): CurveFields {
  const scalar = (
    fieldCurrent: number,
    fieldAnchorCurrent: number,
    fieldAnchorNew: number,
  ) => fieldAnchorNew * (fieldCurrent / fieldAnchorCurrent) ** p;

  const currentMag = Math.hypot(currentLevel.biasXMm, currentLevel.biasYMm);
  const currentAnchorMag = Math.hypot(
    currentAnchor.biasXMm,
    currentAnchor.biasYMm,
  );
  const anchorMag = Math.hypot(anchorValues.biasXMm, anchorValues.biasYMm);
  const newMag =
    currentMag === 0 ? 0 : anchorMag * (currentMag / currentAnchorMag) ** p;
  const unitX = currentMag === 0 ? 0 : currentLevel.biasXMm / currentMag;
  const unitY = currentMag === 0 ? 0 : currentLevel.biasYMm / currentMag;

  return {
    sigmaAlongMm: scalar(
      currentLevel.sigmaAlongMm,
      currentAnchor.sigmaAlongMm,
      anchorValues.sigmaAlongMm,
    ),
    sigmaAcrossMm: scalar(
      currentLevel.sigmaAcrossMm,
      currentAnchor.sigmaAcrossMm,
      anchorValues.sigmaAcrossMm,
    ),
    biasXMm: unitX * newMag,
    biasYMm: unitY * newMag,
    outlierRate: scalar(
      currentLevel.outlierRate,
      currentAnchor.outlierRate,
      anchorValues.outlierRate,
    ),
  };
}

function main(): void {
  const original = { ...LEVEL_SKILL_TABLE } as Record<number, SkillProfile>;
  const live = LEVEL_SKILL_TABLE as Record<number, SkillProfile>;

  let low = 0.1;
  let high = 6;
  let p = (low + high) / 2;
  let level1Average = 0;

  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    p = (low + high) / 2;
    const rescaled1 = rescaleLevel(
      original[1]!,
      original[ANCHOR_LEVEL]!,
      D_E_ANCHOR,
      p,
    );
    live[1] = { ...original[1]!, ...rescaled1 };
    level1Average = simulateTierStats(1, SEARCH_SEED, SEARCH_VISITS)
      .threeDartAverage;
    if (level1Average > LEVEL_1_TARGET_MAX) {
      low = p;
    } else if (level1Average < LEVEL_1_TARGET_MIN) {
      high = p;
    } else {
      break;
    }
  }

  const table: Record<number, CurveFields> = {};
  for (let level = 1; level <= 15; level++) {
    table[level] =
      level === ANCHOR_LEVEL
        ? D_E_ANCHOR
        : rescaleLevel(
            original[level]!,
            original[ANCHOR_LEVEL]!,
            D_E_ANCHOR,
            p,
          );
  }

  console.log(JSON.stringify({ p, level1Average, table }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/scripts/dartbot-level-curve-refit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/dartbot-level-curve-refit.ts app/tests/scripts/dartbot-level-curve-refit.test.ts
git commit -m "Add DartBot level-curve refit script (D-L)"
```

---

### Task 2: Run the refit search and capture its output

**Files:** none (verification/data-gathering only — the printed output feeds Tasks 3–6).

- [ ] **Step 1: Run the script**

Run: `cd app && npx tsx scripts/dartbot-level-curve-refit.ts`

- [ ] **Step 2: Sanity-check the output**

Confirm the printed JSON has `level1Average` inside `[26, 31]` and `table[6]` exactly equal to `{ sigmaAlongMm: 27.5, sigmaAcrossMm: 20.1, biasXMm: -5.0, biasYMm: 3.1, outlierRate: 0.003 }`. If the search did not converge (`level1Average` outside the band after 40 iterations), widen `low`/`high` in Task 1's `main()` and re-run rather than hand-adjusting the printed table.

- [ ] **Step 3: Record the raw output**

Save the full JSON output to a scratch file (not committed) for reference across Tasks 3–6, e.g. the session scratchpad. Do not invent or round values beyond what the current table's own precision already uses (1 decimal place for `sigmaAlongMm`/`sigmaAcrossMm`/`biasXMm`/`biasYMm`, as seen in the existing hand-set rows).

---

### Task 3: Apply the refit to `LEVEL_SKILL_TABLE`

**Files:**
- Modify: `app/src/modules/dartbot/skill-profile.module.ts`
- Test: existing `app/tests/modules/dartbot/skill-profile.module.test.ts` (no new assertions expected — confirm it still passes; `skillProfileForLevel`'s clamping/lookup behavior is unaffected by a data change per the spec's Testing section)

**Interfaces:** none new — `LEVEL_SKILL_TABLE`'s shape and `skillProfileForLevel`'s signature are unchanged; only stored values change.

- [ ] **Step 1: Confirm the existing test still passes before editing (baseline)**

Run: `cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts`
Expected: PASS (baseline, unaffected by the coming data edit).

- [ ] **Step 2: Replace the module's header comment**

Replace lines 3–7 of `app/src/modules/dartbot/skill-profile.module.ts`:

```typescript
/**
 * A hand-set prior (08-DartBot.md §D-E). Throws correct darts today; it
 * cannot yet claim to play like anything measured. Re-fitting from the D-E
 * production-data extract is a data edit to this table, not a redesign.
 */
```

with (D255: states the table's current contract only — which fields are
calibrated vs. hand-set — not the refit's derivation or history):

```typescript
/**
 * Per-level bot throw parameters (D-L, `08-DartBot.md`). `sigmaAlongMm`,
 * `sigmaAcrossMm`, `biasXMm`, `biasYMm` and `outlierRate` are calibrated
 * against a measured population prior; the remaining fields are hand-set
 * independently of it.
 */
```

- [ ] **Step 3: Replace each level's `sigmaAlongMm`, `sigmaAcrossMm`, `biasXMm`, `biasYMm`, `outlierRate`**

Using Task 2's captured output, for each of the 15 levels replace only those 5 fields with the script's `table[level]` values (rounded to 1 decimal place for the mm/degree-scale fields, matching the file's existing precision; `outlierRate` keeps enough decimal places to distinguish adjacent levels, matching the existing style e.g. `0.12`, `0.045`). Leave `covarianceRotationDegrees`, `outlierSigmaMm`, `bedOffsetMm`, `bounceOutRate`, `deflectionRadiusMm`, `decisionQuality` untouched on every level.

- [ ] **Step 4: Run the baseline test again**

Run: `cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts`
Expected: PASS — clamping/lookup behavior is data-independent.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/dartbot/skill-profile.module.ts
git commit -m "Refit LEVEL_SKILL_TABLE against the D-E population prior (D-L)"
```

---

### Task 4: Update `tier-bands.test.ts` bands for levels 1, 8, 15

**Files:**
- Modify: `app/tests/modules/dartbot/harness/tier-bands.test.ts`

**Interfaces:** none — same `simulateTierStats` call shape, only the hardcoded band bounds change.

- [ ] **Step 1: Run the suite to see it fail against the refit table**

Run: `cd app && npx vitest run tests/modules/dartbot/harness/tier-bands.test.ts`
Expected: FAIL on some/all of the level 1/8/15 sanity-band assertions (the profile data changed underneath the same `BASE_SEED = 700000`, `VISITS = 5000`). The monotonicity suite is expected to keep passing — a power-law rescale of positive ratios preserves ordering.

- [ ] **Step 2: Read the actual measured values from the failure output**

Vitest's failure diff reports the real `threeDartAverage`/`checkoutRate`/`trebleRate`/`missRate` for levels 1, 8, 15 at this file's own `BASE_SEED`/`VISITS` (distinct from Task 2's search seed/visit count — do not reuse Task 2's numbers here). Use those measured values, not Task 2's, since this file pins its own seed.

- [ ] **Step 3: Update the three band blocks**

For each of the three `it(...)` blocks (level 1 lines ~13–23, level 8 lines ~25–35, level 15 lines ~37–47), replace the `toBeGreaterThanOrEqual`/`toBeLessThanOrEqual` bounds with a band that (a) contains the measured value from Step 2 with a safety margin proportioned like the current file's existing bands (e.g. level 1's current `threeDartAverage` band spans 27–45, a wide tolerance, not a tight ±5% — keep that same generosity so CI stays robust to engine-internal RNG changes), and (b) for level 1's `threeDartAverage` specifically, keep the lower bound at or below 26 and the upper bound at or above 31, since that is the refit's own verified target band.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/harness/tier-bands.test.ts`
Expected: PASS — all 3 sanity-band tests and all 5 monotonicity tests green.

- [ ] **Step 5: Commit**

```bash
git add app/tests/modules/dartbot/harness/tier-bands.test.ts
git commit -m "Update tier-bands sanity bands for the D-L refit"
```

---

### Task 5: Regenerate the throw-engine determinism snapshot

**Files:**
- Modify: `app/tests/modules/dartbot/throw-engine.determinism.test.ts.snap`

**Interfaces:** none — the snapshot pins exact simulated dart landings, which depend on `LEVEL_SKILL_TABLE`'s values.

- [ ] **Step 1: Run the determinism suite to confirm it currently fails**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts`
Expected: FAIL — snapshot mismatch against the refit table.

- [ ] **Step 2: Regenerate the snapshot**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts -u`

- [ ] **Step 3: Re-run to verify green**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts`
Expected: PASS.

- [ ] **Step 4: Review the snapshot diff before committing**

Confirm the diff only touches numeric landing coordinates/scores — no structural/shape change to the snapshot. A shape change here would mean the throw engine itself changed, which is out of scope for this refit.

- [ ] **Step 5: Commit**

```bash
git add app/tests/modules/dartbot/throw-engine.determinism.test.ts.snap
git commit -m "Regenerate throw-engine determinism snapshot for the D-L refit"
```

---

### Task 6: Add the anchor log

**Files:**
- Create: `docs/architecture/08-DartBot-Anchor-Log.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Create the file**

```markdown
# DartBot Level-Curve Anchor Log

> Append-only (same discipline as `decisions/**`): a re-anchor is a new row
> below, never an edit to an existing one. `LEVEL_SKILL_TABLE`'s live
> anchor-level row must always match this log's latest entry — not
> mechanically gated; keep it true by hand.

| Date | Anchor level | Data source | Measured values (sigmaAlongMm / sigmaAcrossMm / biasXMm / biasYMm / outlierRate) | Spread exponent `p` | Verified level-1 three-dart-average band | Task branch |
| ---- | ------------- | ----------- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------ | ------------ |
| 2026-09-04 | 6 | `D-E-extract.md`, 328 `PLAYER`-only rows (`participant_type_id = 1`); thin sample, `intended_zone_key` composition almost entirely `DOUBLE`/`INNER_BULL` | 27.5 / 20.1 / -5.0 / 3.1 / 0.3% | _fill in from Task 2's script output_ | 26–31 (target); _fill in the measured value from Task 4_ | `claude/dartbot-level-select-stats-23x2l0` |

See `08-DartBot.md` §Resolved: D-L level-curve refit and
`docs/superpowers/specs/2026-09-04-dartbot-level-curve-refit-design.md` for
the method.
```

Fill in the two `_fill in..._` cells with Task 2's actual `p` and Task 4's actual measured level-1 average before committing — this file must not ship with placeholder text.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/08-DartBot-Anchor-Log.md
git commit -m "Add DartBot level-curve anchor log, first row (D-L)"
```

---

### Task 7: Close out D-L in `08-DartBot.md`

**Files:**
- Modify: `docs/architecture/08-DartBot.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Insert the new D-L section**

Immediately after line 729 (the D-E section's "Not yet done" line) and before line 731 (`## Still open`), insert:

```markdown

## Resolved: D-L level-curve refit

**D-L — `LEVEL_SKILL_TABLE` refit.** D-D deferred an average band until D-E fit the level curve; D-E measured a population prior but left `LEVEL_SKILL_TABLE` hand-set. Level 6 is anchored to the D-E values exactly; every other level's `sigmaAlongMm`/`sigmaAcrossMm`/`biasXMm`/`biasYMm`/`outlierRate` is rescaled from its pre-refit ratio to level 6, raised to a spread exponent `p` chosen so level 1's simulated three-dart average lands in 26–31. `decisionQuality`, `bedOffsetMm`, `bounceOutRate`, `deflectionRadiusMm` and `covarianceRotationDegrees` are untouched — D-E measured spatial scatter only. `scripts/dartbot-level-curve-refit.ts` runs the search (`docs/superpowers/specs/2026-09-04-dartbot-level-curve-refit-design.md`).

The anchor, the measured values it used, `p`, and the verified level-1 band are recorded in `08-DartBot-Anchor-Log.md` rather than restated here — a future re-anchor is a new row there, not an edit to this paragraph.

**Not yet done:** `fitProfile()` (phase 10's per-player shrinkage) is still unbuilt, so D-K stays blocked; the level-picker average/checkout UI stays deferred to its own brainstormed task.
```

- [ ] **Step 2: Correct the D-E "Not yet done" line**

Replace line 729:

```markdown
**Not yet done:** this closes only the measurement D-E asked for. `LEVEL_SKILL_TABLE` is not refit against this prior, and `fitProfile()` itself (phase 10) is not built — the number is stored, not yet consumed. Any claim about what a given level *plays* like, and the level-picker average/checkout UI that would show one, stay blocked on that separate, undesigned work.
```

with:

```markdown
**Then done:** `LEVEL_SKILL_TABLE` is now refit against this prior (D-L, below). `fitProfile()` itself (phase 10) is still not built — the level-picker average/checkout UI stays blocked on that separate, undesigned work.
```

- [ ] **Step 3: Reference the anchor log from the Calibration section**

At the end of the paragraph on line 531 (in `## Choosing the opponent's level`, immediately after "...a tier name invented before D-E fits the curve would have to be renamed once it is."), append this sentence to the same paragraph:

```markdown
 The population prior behind this curve, its anchor level, and the exponent that shaped it are tracked in `08-DartBot-Anchor-Log.md` (D-L) rather than here — a future re-anchor updates that file, not this paragraph.
```

- [ ] **Step 4: Add a Related Documents row**

In the Related Documents table (starting line 769), append a new row after the `docs/superpowers/specs/2026-08-20-guest-player-x01-design.md` row:

```markdown
| `08-DartBot-Anchor-Log.md`                                                           | Append-only anchor history for `LEVEL_SKILL_TABLE`'s D-L refit — date, anchor level, measured values, spread exponent `p`, verified level-1 band                |
```

- [ ] **Step 5: Run the doc structural gates**

Run: `bash scripts/check-doc-links.sh && bash scripts/check-context-map.sh`
Expected: both exit 0. If `00-Context-Map.md` or `00-File-Inventory.md` need a new entry for `08-DartBot-Anchor-Log.md`, that is covered by Task 8's `context-maintenance` run, not this step.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/08-DartBot.md
git commit -m "Close out D-L in 08-DartBot.md, correct D-E's Not yet done line"
```

---

### Task 8: Full validation and context maintenance

**Files:** none (verification only).

- [ ] **Step 1: Run the full app validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type-check step reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run format check**

Run: `cd app && npm run format`
Expected: no diff (or stage any formatting fixes it makes).

If Step 2 produced changes:

```bash
git add -A
git commit -m "Apply formatting"
```

- [ ] **Step 3: Run the context-maintenance skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-before-done rule — it covers `00-File-Inventory.md`/context-map registration for the new `08-DartBot-Anchor-Log.md` file and any other drift Task 7 didn't already handle.

- [ ] **Step 4: Run the full test suite one more time**

Run: `cd app && npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Final commit if context-maintenance made changes**

```bash
git add -A
git commit -m "Context maintenance for DartBot level-curve refit"
```

---

## Self-Review Notes

- **Spec coverage:** anchor at level 6 to D-E values ✓; power-law rescale via `ratio_L ^ p` ✓; `p` found by real simulation against `simulate-tier.ts`'s harness, target band 26–31 ✓; `LEVEL_SKILL_TABLE` data edit, non-rescaled fields untouched ✓; new anchor-log file ✓; D-L entry + D-E correction + Calibration reference + Related Documents row in `08-DartBot.md` ✓; tier-bands and determinism-snapshot updates ✓; every non-goal from the spec left untouched ✓.
- **No fabricated numbers:** Task 2 is a dedicated step to run the script and capture real output before any file is edited with concrete values; Task 4 reads real `vitest` failure output rather than assuming Task 2's search seed transfers to `tier-bands.test.ts`'s own fixed seed.
- **Test coverage (D224):** `dartbot-level-curve-refit.ts` gets `dartbot-level-curve-refit.test.ts` (Task 1); `skill-profile.module.ts`'s data edit is covered by its existing test staying green (Task 3) — no new runtime `.ts` file is left uncovered.
- **No placeholders left in committed docs:** Task 6 explicitly calls out filling in the two blank cells before committing.
