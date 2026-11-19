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
<!-- backfill: pending -->

# DartBot v2 recalibration: clipped level-6 fit, level 15 at a ≈101 average

## Context and Problem Statement
the owner's guardrails — level 6 is their own game, the top level should not exceed a ~100 three-dart average. With one board-axis spread for every target, a ~100 average caps checkout near 35%, so the owner's earlier 45–66% level-15 checkout band was dropped. Unclipped, the v2 wild darts inflate sigma to 37.5 / 31.8 mm.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`foldPopulationPrior()` clips wild darts iteratively at 3× radial sigma and reports the clipped share as `outlierRate`. `LEVEL_SKILL_TABLE` is re-anchored: level 6 = the v2 extract's pooled clipped fit (29.5 / 23.5 mm, 1.84% outliers); level 15 = D-N's level 15 × 2.0 (8.8 / 6.0 mm); level 1 searched to a 32–37 average on a base whose levels 1–5 `outlierRate` are pre-multiplied by the level-6 outlier ratio. `LEVEL_SELECT_STATS_TABLE` is regenerated against it.".

### Consequences
level 15 averages ≈101 with ≈35% checkout; level 6 averages ≈45 with ≈7.6% checkout. Wild-dart rates rise ~6× at levels 1–6, so miss rates rise by design. The engine's outlier draw uses `outlierSigmaMm` (frozen), so a 1.84% outlier rate does not reproduce the measured wild-dart share exactly. Re-folding v1 `D-E-extract.json` no longer reproduces the 2026-09-04 anchor-log row. `08-DartBot.md` §Resolved: D-O v2 recalibration; values in `08-DartBot-Anchor-Log.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-17
