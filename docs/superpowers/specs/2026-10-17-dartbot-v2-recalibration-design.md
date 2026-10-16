# DartBot v2 Recalibration — Design

Date: 2026-10-17 · Status: draft, awaiting owner approval · Branch: `fix/bot-quick-score-rng` (same worktree as the QUICK_SCORE index fix, D465, per owner direction)

## Intent

The owner has thrown ~7× more tracked darts since the D-E prior (328 rows, 2026-09-04) and wants `LEVEL_SKILL_TABLE` refit against them. Level 6 stays "the owner's own game"; every other level follows from it, and the top of the scale is pulled down to a realistic elite (≈100 three-dart average) instead of today's ≈136.

Context: the owner's report of a level-6 bot "stuck on 40, missing every dart" was the QUICK_SCORE replay bug (D465), not calibration. This refit is therefore about matching the curve to newer, larger data — not about fixing that symptom.

## Goals

1. Level 6 = a pooled fit of the owner's v2 darts, with wild darts filtered out of the spread.
2. Level 15 = the owner-chosen point: σ along/across 8.8 / 6.0 mm, ≈101.3 three-dart average, ≈35% checkout (per dart at D20).
3. Level 1 keeps D-N's compromise band (three-dart average 32–37).
4. Levels 2–5 and 7–14 are filled by D-N's existing two-segment log-space interpolation.
5. The level-picker bands (`LEVEL_SELECT_STATS_TABLE`, D-M) are regenerated against the new table.
6. The run is reproducible from committed code + committed data, and recorded in the anchor log and decision ledger.

## Non-goals

- No change to the miss model: still one board-axis Gaussian for every target, no radial/tangential frame, no per-zone (double vs treble) accuracy, no pressure or form terms. Owner: "enough for now".
- No change to `decisionQuality`, `bedOffsetMm`, `bounceOutRate`, `deflectionRadiusMm`, `covarianceRotationDegrees`, `outlierSigmaMm` — same untouched set as D-L/D-N.
- No `fitProfile()` / per-player shrinkage (phase 10, D-K) — still unbuilt.
- No change to the engine, strategy, RNG, or play-page wiring.

## Anti-goals

- Level 15 averaging above ~101 or behaving like today's near-certain treble-20 bot.
- Weaker levels throwing *fewer* wild darts than level 6 (a non-monotonic outlier curve).
- A green suite reached by loosening tests until they pass: any band test whose numbers move is re-pointed at the new owner-approved guardrails and says so.

## Decided (by the owner, in conversation)

| Decision | Value |
| -------- | ----- |
| Level 6 anchor | Owner's v2 darts, pooled across all intended zones in the extract (DOUBLE, TREBLE, INNER_BULL) |
| Wild-dart handling | Filtered out of the spread before fitting; their share becomes `outlierRate` |
| Level 15 anchor | σ 8.8 / 6.0 mm (= today's level 15 × 2.0) · simulated ≈101.3 average · ≈35.0% checkout |
| Level 15 checkout | ≈35% accepted — the owner dropped the earlier 45–66% band once shown it is unreachable at a ~100 average without a separate double-accuracy axis (out of scope) |
| Miss-model changes | None for now |

## Measured inputs

Source: `D-E-extract-v2-doubles-trebles.json` (2,230 `PLAYER`-only rows: 1,192 DOUBLE, 966 TREBLE, 72 INNER_BULL; rows carry `intended_zone_key`). Its sibling `D-E-extract-v2-all-targets.json` holds the same 2,230 darts keyed by `intended_zone_id`, so it adds nothing; it is not used.

Pooled fit, iterative 3σ clip (measured 2026-10-17 by a throwaway script; the build must reproduce these through the real fold, ±0.1 mm / ±0.1 pp):

| Field | Value |
| ----- | ----- |
| `sigmaAlongMm` | 29.5 |
| `sigmaAcrossMm` | 23.5 |
| `biasXMm` | −1.2 |
| `biasYMm` | −1.6 |
| `outlierRate` | 1.8% (41 of 2,230) |
| kept / sample | 2,189 / 2,230 |

For reference only (not anchors): doubles-only filtered 27.0 / 21.9, trebles-only 31.9 / 25.0; unfiltered pooled 37.5 / 31.8.

**Clip rule** (decided by the owner as "filter the wild darts"; the rule itself is my call): compute bias and σ over the kept set, drop every dart farther than `3 × sqrt(σalong² + σacross²)` from the bias-shifted centroid, repeat until the kept set stops changing; σ and bias come from the final kept set, `outlierRate` = dropped / total. This is D-E's existing 3σ threshold, made iterative so the wild darts stop inflating the σ that defines them.

## How it gets built (shape, not plan)

1. **Data.** Both v2 files are committed at the repo root under their own names, beside `D-E-extract.json`: `D-E-extract-v2-all-targets.json` (from `D-E-extract.md`'s first query, `intended_zone_id`) and `D-E-extract-v2-doubles-trebles.json` (its second, `missMargin()` query, `intended_zone_key`). `D-E-extract.md` now carries the two queries only; the results live in the JSON files. The fold reads the doubles-trebles file.
2. **Fold.** `foldPopulationPrior()` (`app/src/modules/dartbot/population-prior.module.ts`) gains the iterative clip, always on (my call — no opt-out flag). Its signature and `PopulationPrior` shape stay; `excludedCount` keeps meaning "rows with no centre or no location", not clipped darts; `sampleSize` stays "located darts" (2,230); `outlierRate` = clipped ÷ located darts, as the current code divides (my call). Consequence: re-folding v1 `D-E-extract.json` no longer reproduces the 2026-09-04 anchor-log row's 27.5 / 20.1 / 0.3%. That row stays as written (the log is append-only); the new row says the fold changed. TDD per `app/CLAUDE.md`. Existing fold tests whose expected values change because of the clip are re-pointed at the clipped expectation with the reason stated, never at a different input.
3. **Recalibration script.** `app/scripts/dartbot-level-curve-recalibration.ts`:
   - `MID_ANCHOR` → the fold's output for the v2 extract.
   - Level 15 is set directly to `scaleCurve(original[15], 2.0)` — no checkout search; the owner picked the point. The script asserts its simulated average sits in [99, 103] at the search seed and fails otherwise. The old `LEVEL_15_CHECKOUT_*` / `LEVEL_15_AVG_MIN` guardrails are replaced by this.
   - **Outlier curve (my call):** before the level-1 search and interpolation, level 1–5's pre-edit `outlierRate` is multiplied by `newMid.outlierRate / original[6].outlierRate` (≈6×, level 1 base ≈5.8%), so the 1→6 segment stays monotone and level 6 lands on 1.8%. Without it, level 6's jump from 0.3% to 1.8% would sit above level 1 and create a peak at 6. Level 15 is **not** multiplied: it is exactly the owner's measured row (`scaleCurve(original[15], 2.0)`, outlier 0.04%), so the 101.3 average reproduces. The 6→15 segment interpolates 1.8% → 0.04%, monotone by construction.
   - Level 1's average search (32–37) runs on that adjusted base, unchanged otherwise.
   - **No fallback (my call):** if level 1 cannot reach 32–37, or level 15 leaves [99, 103], or any monotonicity test fails, the script/build halts and reports to the owner. No silent re-tuning.
4. **Table.** Paste the script's output into `LEVEL_SKILL_TABLE` (`skill-profile.module.ts`) for the five fitted fields; round as the current table does (σ 1 dp, bias 2 dp, outlier 4 dp). Bias direction rule from D-N/flat-spot fix stays: adjacent levels must not share a bias pair, bias magnitude strictly decreasing 7→15 (`skill-profile.module.test.ts`). If interpolation produces a flat spot or violates that, fix it the way `dartbot-bias-flatspot-fix.ts` did and say so.
5. **Level-picker stats.** Re-run `app/scripts/dartbot-level-select-stats.ts` (N = 5000, seed `800000 + level`) and replace `LEVEL_SELECT_STATS_TABLE`.
6. **Sanity bands.** `tests/modules/dartbot/harness/tier-bands.test.ts`'s level-8 and level-15 bands encode the old curve (level 15: average 115–160, checkout/treble 0.5–0.75). They are re-pointed at the new owner-approved guardrails — level 15: average 97–105, checkout and treble 0.30–0.40, miss ≤ 0.01 — and level 8's band is re-derived from the new table's measured values with the same relative margins the current band uses. Level 8's **miss** band is absolute (`[0, 0.003]`) and will break, because the owner-approved 1.8% wild-dart rate raises miss rates by design; its new ceiling is 2× level 8's measured miss rate at the test seed (my call), and the test comment states that this follows from the outlier change. Level 1's band stays unless the new numbers leave it, in which case stop and report. Monotonicity tests stay untouched and must pass.
7. **Records.** New anchor-log row in `08-DartBot-Anchor-Log.md`; `08-DartBot.md` gets a `## Resolved:` entry plus version-header entry; a new decision in `decisions/game-engine.md` (next id via `scripts/next-decision-id.sh`); File Inventory rows for the new data file and any changed script; Context-Map-History row.

## Expected effect (my estimate, to verify)

- Level 6 gets slightly looser (σ 29.5/23.5 vs 27.5/20.1) and throws ~6× more wild darts → a few points lower average and checkout than today's level 6.
- Level 15 drops from ≈136 to ≈101 average, ≈63% to ≈35% checkout.
- Levels 7–14 compress toward the lower top; level 8 will likely fall below today's ~60 average.

## Known gap (accepted, recorded in the decision)

The fit calls a dart "wild" at > 3 × 37.8 ≈ 113 mm from centre, but the engine throws an outlier draw with `outlierSigmaMm` (65 mm at level 6, frozen by the non-goals). So a 1.8% outlier rate does not recreate the measured wild-dart share exactly: many outlier draws land closer than 113 mm. Fixing it means touching `outlierSigmaMm`, which is the miss-model work the owner deferred.

## Left to the builder

- Plan steps, commit slicing, test names.
- Whether the fold's clip loop gets an iteration cap (it converges; a cap is a safety net).
- Exact rounding of re-derived level-8 band edges.

## Open items

None. (Extract provenance: the two queries in `D-E-extract.md`. The #971 hook fix landed on `main` via #975, 2026-10-17.)
