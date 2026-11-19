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

# Adjacent DartBot levels never share a bias pair, and a test says so

## Context and Problem Statement
`LEVEL_SKILL_TABLE` is meant to be 15 distinct hand-tuned points. Three pairs shared an exact bias pair from before D-L, and because both D-L's power-law rescale and D-N's log-space interpolation operate on pre-edit per-level ratios, a pair identical before an edit stayed identical after it — two refits carried the artifact forward (issue #286). Nothing asserted anything about bias across levels, which is exactly why it survived unnoticed. The magnitude assertion starts at level 7 because level 6's measured `-5.0` is real data and legitimately breaks any 1→15 ordering.

## Decision Drivers
* Levels 7/8, 9/10 and 12/13 of `LEVEL_SKILL_TABLE` each shared an exact `biasXMm`/`biasYMm` pair, inherited from the table before D-L (PR #439 body).
* Both later refits are ratio-preserving, so a pair equal before an edit stayed equal after it (PR #439 body).
* Level 6's measured `-5.0` bias is a sign anomaly, so a geometric ratio from a negative endpoint to a positive one is undefined (PR #439 body).

## Considered Options
* Leave the shared pairs as they are (status quo).
* Re-derive the 6 levels by geometric interpolation between their nearest distinct neighbours (chosen).

## Decision Outcome
Chosen option: "levels 7, 8, 9, 10, 12 and 13 get `biasXMm`/`biasYMm` values derived by geometric interpolation between their nearest distinct neighbours (`app/scripts/dartbot-bias-flatspot-fix.ts`). `skill-profile.module.test.ts` now asserts that no adjacent level pair shares an identical `(biasXMm, biasYMm)` pair across all 15 levels, and that bias magnitude shrinks from level 7 to 15. Anchors 1, 6 and 15 are untouched, as is every non-bias field.".

### Consequences
the committed `throw-engine.determinism.test.ts` snapshot is regenerated, because it is taken at level 8 — one of the moved levels. A determinism snapshot pinned to a tunable level will break on every future refit; that is now a known, accepted cost rather than a surprise. The tier bands for levels 1, 8 and 15 were re-verified by simulation at the harness's own seed and still hold.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/dartbot/skill-profile.module.test.ts` asserts that no adjacent level pair shares a bias pair and that bias magnitude shrinks from level 7 to 15. `app/tests/modules/dartbot/harness/tier-bands.test.ts` checks the tier bands, and `app/tests/modules/dartbot/throw-engine.determinism.test.ts` holds the regenerated snapshot.

## Pros and Cons of the Options
### Leave the shared pairs
* Bad, because the artifact carries forward through every ratio-preserving refit (PR #439 body).

### Geometric interpolation between distinct neighbours
* Good, because the module diff is 12 bias lines plus a docstring paragraph, and anchors 1, 6 and 15 stay untouched (PR #439 body).
* Good, because the tier bands for levels 1, 8 and 15 re-verified by simulation at the harness seed (PR #439 body).
* Bad, because the level-8 determinism snapshot is regenerated, and a snapshot pinned to a tunable level breaks on every future refit (PR #439 body).

## Evidence / More Information
Decided: 2026-09-18

* Commit `3412047f` (PR #439, 2026-09-18; adds the D313 row to `decisions/game-engine.md`): rebuilt Considered Options and Pros and Cons.
* PR #439 body (Summary, test-side changes, Verification): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
