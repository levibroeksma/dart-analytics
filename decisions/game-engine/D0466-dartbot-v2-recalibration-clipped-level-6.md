---
id: D0466
status: accepted
date: 2026-10-17
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# DartBot v2 recalibration: clipped level-6 fit, level 15 at a ≈101 average

## Context and Problem Statement
the owner's guardrails — level 6 is their own game, the top level should not exceed a ~100 three-dart average. With one board-axis spread for every target, a ~100 average caps checkout near 35%, so the owner's earlier 45–66% level-15 checkout band was dropped. Unclipped, the v2 wild darts inflate sigma to 37.5 / 31.8 mm.

## Decision Drivers
* Level 6 stays "the owner's own game", fitted to the owner's larger v2 dart set (spec Intent, Goals 1).
* The top level should not exceed a three-dart average of about 100; v1 level 15 averages about 136 (spec Intent).
* Weaker levels must not throw fewer wild darts than level 6 (spec Anti-goals).

## Considered Options
* Re-fit the level table: clipped level-6 fit, level 15 at 8.8 / 6.0 mm (chosen).
* Keep the v1 table, whose level 15 averages about 136 (status quo).

## Decision Outcome
Chosen option: "`foldPopulationPrior()` clips wild darts iteratively at 3× radial sigma and reports the clipped share as `outlierRate`. `LEVEL_SKILL_TABLE` is re-anchored: level 6 = the v2 extract's pooled clipped fit (29.5 / 23.5 mm, 1.84% outliers); level 15 = D-N's level 15 × 2.0 (8.8 / 6.0 mm); level 1 searched to a 32–37 average on a base whose levels 1–5 `outlierRate` are pre-multiplied by the level-6 outlier ratio. `LEVEL_SELECT_STATS_TABLE` is regenerated against it.".

### Consequences
level 15 averages ≈101 with ≈35% checkout; level 6 averages ≈45 with ≈7.6% checkout. Wild-dart rates rise ~6× at levels 1–6, so miss rates rise by design. The engine's outlier draw uses `outlierSigmaMm` (frozen), so a 1.84% outlier rate does not reproduce the measured wild-dart share exactly. Re-folding v1 `D-E-extract.json` no longer reproduces the 2026-09-04 anchor-log row. `08-DartBot.md` §Resolved: D-O v2 recalibration; values in `08-DartBot-Anchor-Log.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/scripts/dartbot-level-curve-recalibration.test.ts` covers the curve scaling and interpolation helpers. `app/tests/modules/dartbot/harness/tier-bands.test.ts` holds a level-15 band of 97-105 average and at least 0.3 checkout rate.

## Pros and Cons of the Options
### Re-fit the level table
* Good, because level 15 averages about 101 instead of about 136.
* Good, because the clip stops wild darts from inflating the spread that defines them.
* Bad, because miss rates at levels 1-6 rise by design.

### Keep the v1 table
* Bad, because level 15 averages about 136, above the owner's guardrail.

## Evidence / More Information
Decided: 2026-10-17

* `docs/superpowers/specs/2026-10-17-dartbot-v2-recalibration-design.md` (Intent, Goals, Anti-goals, Decided, step 6): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons.
* Commit `f4b868ab` (2026-10-17): adds the original ledger block.
