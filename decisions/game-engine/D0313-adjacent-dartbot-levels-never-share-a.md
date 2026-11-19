---
id: D0313
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [game-engine, engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Adjacent DartBot levels never share a bias pair, and a test says so

## Context and Problem Statement
`LEVEL_SKILL_TABLE` is meant to be 15 distinct hand-tuned points. Three pairs shared an exact bias pair from before D-L, and because both D-L's power-law rescale and D-N's log-space interpolation operate on pre-edit per-level ratios, a pair identical before an edit stayed identical after it — two refits carried the artifact forward (issue #286). Nothing asserted anything about bias across levels, which is exactly why it survived unnoticed. The magnitude assertion starts at level 7 because level 6's measured `-5.0` is real data and legitimately breaks any 1→15 ordering.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "levels 7, 8, 9, 10, 12 and 13 get `biasXMm`/`biasYMm` values derived by geometric interpolation between their nearest distinct neighbours (`app/scripts/dartbot-bias-flatspot-fix.ts`). `skill-profile.module.test.ts` now asserts that no adjacent level pair shares an identical `(biasXMm, biasYMm)` pair across all 15 levels, and that bias magnitude shrinks from level 7 to 15. Anchors 1, 6 and 15 are untouched, as is every non-bias field.".

### Consequences
the committed `throw-engine.determinism.test.ts` snapshot is regenerated, because it is taken at level 8 — one of the moved levels. A determinism snapshot pinned to a tunable level will break on every future refit; that is now a known, accepted cost rather than a surprise. The tier bands for levels 1, 8 and 15 were re-verified by simulation at the harness's own seed and still hold.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
