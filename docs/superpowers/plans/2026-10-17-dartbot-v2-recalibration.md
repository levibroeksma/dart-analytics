# DartBot v2 Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refit `LEVEL_SKILL_TABLE` with level 6 = a 3σ-clipped pooled fit of the 2,230-dart v2 extract, level 15 = σ 8.8 / 6.0 mm (≈101 avg), level 1 = D-N compromise, and regenerate the level-picker bands.

**Architecture:** The clip goes into `foldPopulationPrior()`. `dartbot-level-curve-recalibration.ts` gets the new anchors and an outlier pre-multiplier, then its printed table is pasted into `skill-profile.module.ts`. Band tests that encode the old curve are re-pointed at the owner's new guardrails. No engine, strategy or play-page change.

**Tech Stack:** TypeScript, Vitest, `npx tsx` for the one-off scripts (run from `app/`).

**Spec:** `docs/superpowers/specs/2026-10-17-dartbot-v2-recalibration-design.md`

## Global Constraints

- Branch: cut `feat/dartbot-v2-recalibration` from `origin/main` **after PR #977 merges** (#977 carries the spec and the v2 extract). Launch with `claude --worktree feat/dartbot-v2-recalibration`.
- TDD per `app/CLAUDE.md` §Test-Driven Development; tests mirror `app/src/` / `app/scripts/` under `app/tests/`.
- No `//` comments inside function bodies in `app/src/**` (`check-no-inline-comments.sh`). Doc comments document the declaration and cite `(D<id>)` instead of narrating history.
- Untouched fields: `decisionQuality`, `bedOffsetMm`, `bounceOutRate`, `deflectionRadiusMm`, `covarianceRotationDegrees`, `outlierSigmaMm`.
- Table rounding: σ to 1 dp, bias to 2 dp, `outlierRate` to 4 dp.
- Re-pointed tests keep the same guarantee and say why the numbers moved (root `CLAUDE.md` Hard Invariant). Never widen a band just to go green.
- Halt and report to the owner, with no re-tuning, if: level 1 cannot reach an average of 32–37; level 15 falls outside [99, 103]; any monotonicity test fails; level 1's tier band fails.
- Decision id: `bash scripts/next-decision-id.sh` at the start of Task 4, and again right before the PR.

## Review Focus

1. **Clip with identical darts.** A cluster of identical offsets has σ = 0, so the clip limit is 0. Darts exactly at the bias must be kept (`<=`, not `<`); otherwise the whole set drops and the next iteration divides by zero. Pinned in Task 1 ("keeps a zero-spread cluster and still clips the far dart").
2. **Clip leaves fewer than 2 darts.** Sample stddev needs n ≥ 2. Expected: the fold returns σ 0 rather than NaN. Pinned in Task 1.
3. **Clip never converges** (oscillation). Expected: it stops after a fixed cap and returns the last kept set. Pinned in Task 1 by test name; the cap value is the builder's choice.
4. **Outlier multiplier hits level 6 itself.** Level 6 must end at exactly the fold's rate, not 6× it. Pinned in Task 2 (`scaleOutlierRates` touches only the listed levels).
5. **Unrelated tests pinned to old table values** (determinism snapshot, seeded play tests). Expected: each failure is either re-recorded because its input changed, or stops the task. None is loosened. Covered in Task 2, Step 9.

---

### Task 1: Iterative 3σ clip in the population-prior fold

**Files:**
- Modify: `app/src/modules/dartbot/population-prior.module.ts`
- Test: `app/tests/modules/dartbot/population-prior.module.test.ts`
- Test: `app/tests/scripts/dartbot-population-prior.test.ts`

**Interfaces:**
- Produces: `foldPopulationPrior(rows: readonly MissMarginInput[]): PopulationPrior`. Signature and `PopulationPrior` shape are unchanged. `sigma*`/`bias*` come from the final kept set. `outlierRate` = clipped ÷ located darts. `sampleSize` = located darts. `excludedCount` = rows with no centre or no location.

- [ ] **Step 1: Write the failing fold tests** in `population-prior.module.test.ts` (use the existing `darts()` helper):
  - `"excludes clipped wild darts from sigma and bias"`: 20 darts alternating `{dx:-2,dy:0}` / `{dx:2,dy:0}` plus one `{dx:300,dy:300}` → `outlierRate ≈ 1/21`, `biasXMm ≈ 0`, `biasYMm ≈ 0`, `sigmaAcrossMm ≈ sqrt(80/19)` (precision 5), `sigmaAlongMm ≈ 0`, `sampleSize === 21`.
  - `"keeps a zero-spread cluster and still clips the far dart"`: 20 × `{dx:1,dy:-1}` + `{dx:500,dy:500}` → `outlierRate ≈ 1/21`, `biasXMm ≈ 1`, `sigmaAcrossMm === 0`.
  - `"re-clips until the kept set is stable"`: 40 darts at radius 1 (alternate `±1` on x), 2 at `{dx:30,dy:0}`, 1 at `{dx:400,dy:0}`. Assert `outlierRate ≈ 3/43`: the 30 mm darts survive the first pass only because the 400 mm dart inflates σ.
  - `"returns zero sigma when the clip keeps fewer than two darts"`: one dart → `sigmaAlongMm === 0`, `sigmaAcrossMm === 0`, `Number.isNaN` false on all fields.
  - `"stops after a bounded number of passes"`: any input whose kept set alternates. If you can't build one, assert the function returns on the Step 1 inputs, and note the cap in the doc comment.
- [ ] **Step 2:** In `dartbot-population-prior.test.ts`, add `describe("D-E-extract-v2-doubles-trebles.json")`. It reads `../../../D-E-extract-v2-doubles-trebles.json` and runs `foldPopulationPrior(toMissMarginInputs(rows))`. Assert `rows.length === 2230`, `sampleSize === 2230`, and each of the following within ±0.1 (`toBeCloseTo(v, 1)` is ±0.05, so use `Math.abs(x - v) <= 0.1`): `sigmaAlongMm` 29.5, `sigmaAcrossMm` 23.5, `biasXMm` −1.2, `biasYMm` −1.6. Also assert `outlierRate` within ±0.001 of 41/2230.
- [ ] **Step 3: Run** `npx vitest run tests/modules/dartbot/population-prior.module.test.ts tests/scripts/dartbot-population-prior.test.ts`. Expected: the new tests FAIL. `"excludes clipped…"` shows a non-zero σ along, and v2's σ along is ≈ 37.5.
- [ ] **Step 4: Implement** the clip inside `foldPopulationPrior`. Each pass fits bias and σ over the kept set, then keeps every located dart within `3 × hypot(σalong, σacross)` of the bias-shifted centroid, using `<=`. Stop when the kept count stops changing or a pass cap is reached. Update the doc comment: wild darts are clipped iteratively, `outlierRate` is the clipped share (D465 is the QUICK_SCORE decision; cite this task's decision id from Task 4, or "(08-DartBot.md)" until then).
- [ ] **Step 5: Run** the same command. Expected: PASS, including the existing tests. If `"counts a row beyond 3-radial-sigma as an outlier"` or `"reads sigma as…"` now fails, re-point it at the clipped expectation and state why in the test name. Do not change its input.
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Commit:** `git add app/src/modules/dartbot/population-prior.module.ts app/tests/modules/dartbot/population-prior.module.test.ts app/tests/scripts/dartbot-population-prior.test.ts && git commit -m "feat(dartbot): population prior clips wild darts iteratively"`

### Task 2: New anchors, outlier pre-multiplier, refit table

**Files:**
- Modify: `app/scripts/dartbot-level-curve-recalibration.ts`
- Modify: `app/src/modules/dartbot/skill-profile.module.ts` (`LEVEL_SKILL_TABLE`)
- Test: `app/tests/scripts/dartbot-level-curve-recalibration.test.ts`
- Test: `app/tests/modules/dartbot/skill-profile.module.test.ts`
- Test: `app/tests/modules/dartbot/harness/tier-bands.test.ts`
- Possibly: `app/tests/modules/dartbot/__snapshots__/throw-engine.determinism.test.ts.snap`

**Interfaces:**
- Consumes: Task 1's fold output for the v2 extract.
- Produces: `export function scaleOutlierRates(table: Readonly<Record<number, CurveFields>>, factor: number, levels: readonly number[]): Record<number, CurveFields>`. It returns a copy; only the listed levels' `outlierRate` is multiplied, and every other field and level stays identical.
- Produces: `export const LEVEL_15_SCALE = 2.0`, `LEVEL_15_AVG_MIN = 99`, `LEVEL_15_AVG_MAX = 103`.

- [ ] **Step 1: Write failing script tests** in `dartbot-level-curve-recalibration.test.ts`:
  - `"scaleOutlierRates multiplies only the listed levels' outlier rate"`: a 3-level table; factor 6 on levels `[1]`. Level 1's `outlierRate` is ×6, level 1's σ/bias unchanged, levels 2–3 deep-equal the input.
  - `"scaleOutlierRates does not mutate its input"`.
- [ ] **Step 2: Run** `npx vitest run tests/scripts/dartbot-level-curve-recalibration.test.ts`. Expected: FAIL, `scaleOutlierRates` not exported.
- [ ] **Step 3: Edit the script:**
  - Add `scaleOutlierRates`.
  - `MID_ANCHOR` = Task 1's v2 fold output, rounded per Global Constraints. Run `npx tsx scripts/dartbot-population-prior.ts ../D-E-extract-v2-doubles-trebles.json` to get it.
  - In `main()`, build the base table as `scaleOutlierRates(original, MID_ANCHOR.outlierRate / original[6].outlierRate, [1, 2, 3, 4, 5])`. Search level 1 on that base, unchanged otherwise. Set `level15New = scaleCurve(original[15], LEVEL_15_SCALE)`, using `original`, not the multiplied base. Simulate level 15 at `SEARCH_SEED` / `SEARCH_VISITS` and throw if its average is outside [`LEVEL_15_AVG_MIN`, `LEVEL_15_AVG_MAX`].
  - Interpolate from the multiplied base.
  - Delete `searchLevel15`, `LEVEL_15_CHECKOUT_MIN/MAX` and the old `LEVEL_15_AVG_MIN = 90`.
- [ ] **Step 4: Run** the script test. Expected: PASS.
- [ ] **Step 5: Run the search:** `npx tsx scripts/dartbot-level-curve-recalibration.ts > /tmp/refit.json` (or a scratchpad path). Expected: exit 0, level 1 average in 32–37, level 15 average in 99–103. If it throws, stop and report.
- [ ] **Step 6: Write failing table tests** in `skill-profile.module.test.ts`:
  - Re-point `"anchors level 6 to the D-E measured population prior"` → `"anchors level 6 to the v2 clipped pooled fit"`, with `MID_ANCHOR`'s rounded values.
  - Re-point `"anchors level 1 and level 15 to the D-N recalibration's found values"` → `"…to the v2 recalibration's values"`: level 15 σ `8.8` / `6.0`; level 1 σ = the Step 5 output, rounded.
  - The flat-spot and bias-decreasing tests stay as they are.
- [ ] **Step 7: Paste** the Step 5 table into `LEVEL_SKILL_TABLE` for the five fitted fields only, rounded. Update the table's doc comment to name the v2 anchors (cite the Task 4 decision id).
- [ ] **Step 8: Re-point `tier-bands.test.ts`.** First measure levels 1, 8 and 15 with `simulateTierStats(level, 700000 + level, 5000)`. Then:
  - **Level 15:** average 97–105, checkout 0.30–0.40, treble 0.30–0.40, miss 0–0.01.
  - **Level 8** (measured value `m`):
    - average `[0.826m, 1.288m]`
    - checkout `[0.79m, 1.58m]`
    - treble `[0.897m, 1.494m]`
    - miss `[0, 2m]`

    Round the edges to 2–3 significant figures. Comment each bound: these ratios are the old band's margins around its own measured value (anchor log, 2026-09-18 row); the miss ceiling follows from the owner-approved 1.8% wild-dart rate (spec §Sanity bands).
  - **Level 1:** unchanged. If it fails, stop and report.
  - **Monotonicity tests:** unchanged.
- [ ] **Step 9: Run** `npm test`. Expected: all pass.
  - If the determinism snapshot fails, re-record it with `npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts -u`. Its inputs (the profiles) changed, so this is allowed. Name it in the commit body.
  - Any other failure tied to bot outcomes: the subject changed, so re-point that test with the same guarantee and list it in the commit body. If it isn't a bot-outcome test, stop and report.
- [ ] **Step 10: Run** `npm run check`, then `bash ../scripts/fallow-gate.sh`. Expected: 0 errors, 0 warnings, 0 hints, and 0 above threshold.
- [ ] **Step 11: Commit:** `git add app/scripts/dartbot-level-curve-recalibration.ts app/src/modules/dartbot/skill-profile.module.ts app/tests/scripts/dartbot-level-curve-recalibration.test.ts app/tests/modules/dartbot/` and commit `"feat(dartbot): refit level curve to v2 extract"`. The body lists the measured level 1/6/8/15 stats and every re-pointed test.

### Task 3: Regenerate level-picker bands

**Files:**
- Modify: `app/src/modules/dartbot/level-select-stats.module.ts` (`LEVEL_SELECT_STATS_TABLE`)
- Test: `app/tests/modules/dartbot/level-select-stats.module.test.ts`

**Interfaces:**
- Consumes: Task 2's `LEVEL_SKILL_TABLE`.
- Produces: the new `LEVEL_SELECT_STATS_TABLE`. Its shape is unchanged.

- [ ] **Step 1: Write the failing test** `"level 15's bands match the v2 elite point"`: `levelSelectStatsForLevel(15)` → `averageLow >= 90`, `averageHigh <= 130`, `checkoutLow >= 28`, `checkoutHigh <= 42`. These are the 25th–75th percentiles around the ~101 average and ~35% checkout. Visit totals spread wide, so the average edges are deliberately loose.
- [ ] **Step 2: Run** `npx vitest run tests/modules/dartbot/level-select-stats.module.test.ts`. Expected: FAIL (`checkoutLow` is 62).
- [ ] **Step 3: Regenerate:** `npx tsx scripts/dartbot-level-select-stats.ts`, then paste the output into `LEVEL_SELECT_STATS_TABLE`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. If Step 1's bounds fail on the real output, stop and report rather than move them.
- [ ] **Step 5: Commit** `"feat(dartbot): regenerate level-select stats for v2 curve"`.

### Task 4: Records

**Files:**
- Modify: `docs/architecture/08-DartBot-Anchor-Log.md`: append one row.
- Modify: `docs/architecture/08-DartBot.md`: new `## Resolved: D-O v2 recalibration` section after D-N, plus a version-header entry (next patch version).
- Modify: `decisions/game-engine.md`: new block.
- Modify: `docs/architecture/00-File-Inventory.md`: update the rows for `population-prior.module.ts`, `dartbot-level-curve-recalibration.ts` and `skill-profile.module.ts` if they describe the fold or anchors.
- Modify: `docs/architecture/00-Context-Map-History.md`: one row.

- [ ] **Step 1:** Write the anchor-log row. Date 2026-10-17; anchors 1/6/15; data source v2 extract (2,230 darts) with the clip rule. Include the measured level-6 values; level-15 scale 2.0; the level-1 scale and average; the level 1/8/15 tier-band stats at `700000 + level`; and the note that re-folding v1 no longer reproduces the 2026-09-04 row because the fold now clips.
- [ ] **Step 2:** Add the decision block (`bash scripts/next-decision-id.sh`).
  - **Decision:** the fold clips iteratively at 3σ; level 6 = the v2 pooled fit; level 15 = D-N's level 15 × 2.0; levels 1–5 get the outlier pre-multiplier.
  - **Reason:** the owner's guardrails, plus the reach limit (level 15 can't have both a ~100 average and 45%+ checkout with one spread).
  - **Consequences:** level 15 checks out at about 35%; the known `outlierSigmaMm` gap (spec §Known gap).
  - **Supersedes:** none. D-N's anchors are superseded in the anchor log, not as a decision.

  Back-fill that id into Task 1's and Task 2's doc comments (`skill-profile.module.ts`, `population-prior.module.ts`).
- [ ] **Step 3:** Write the `08-DartBot.md` section, the inventory rows and the history row, each with ISO date 2026-10-17.
- [ ] **Step 4: Run** every gate in the `run-all-gates` skill plus `bash scripts/check-decision-ids.sh`, then `npm test` and `npm run check`. Expected: all OK.
- [ ] **Step 5: Commit** `"docs(dartbot): record v2 recalibration (D<id>)"`. Then push, re-run `next-decision-id.sh`, and open the PR per `finishing-a-dart-branch`.
