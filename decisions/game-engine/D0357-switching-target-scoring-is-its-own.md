---
id: D0357
status: superseded
date: 2026-10-20
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0474
---

# Switching Target Scoring is its own exercise type, sharing Target Scoring's locked point table

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/switching-target-scoring.md`) advance on every hit and restart on every miss — neither Target Scoring's fold (advance only on a broken chain, D356) nor Switching's (dart-by-dart cycle, no chain, no bull, D297). Sharing the point function keeps the two exercises' scoring from drifting apart.

## Decision Drivers
* Scoring is locked by the rules, so the exercise reuses `targetScoringPoints` and shares the point table instead of copying it.
* The exercise folds a dart sequence that advances on every hit and restarts on every miss.

## Considered Options
* Reuse Target Scoring's fold, which advances only on a broken chain (D356).
* Reuse Switching's fold, a dart-by-dart cycle with no chain and no bull (D297).
* Add a new exercise type with its own engine that shares Target Scoring's point function (chosen).

## Decision Outcome
Chosen option: "`SWITCHING_TARGET_SCORING` / `SWITCHING_TARGET_SCORING_V1` is a new exercise type (seed `0024`) with its own `DartExerciseEngine` (`switching-target-scoring.engine.module.ts`). Its configuration is `targets` alone — exactly three distinct board targets, `1`–`20` or `25`. A hit advances to the next target (wrapping after the last, chain kept); a miss resets the chain and restarts the sequence at the first target, mid-visit included; the sequence carries across visit boundaries. Scoring reuses `targetScoringPoints` from the Target Scoring engine rather than copying the table. Intended zone and turn shape as D356. Routine step only.".

### Consequences
a change to Target Scoring's point table changes both exercises at once, which is the intent; a divergent table would be a new ruleset version on one of them. A sequence length other than three is a new ruleset version, not a config edit. Standalone play stays deferred (V2+).
* Neutral, because the routine builder offered the exercise through `v_exercise_template_catalog` once seeded; there was no standalone page and no seeded routine. Commit `87c15cab` later erased the type.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `fa812644` added the engine, its validator and their tests, including `switching-target-scoring.engine.module.test.ts`. Commit `87c15cab` erased the exercise type and its code, so no standing check covers this record today.

## Pros and Cons of the Options
### Reuse Target Scoring's fold
* Bad, because the rules advance on every hit, while that fold advances only on a broken chain.

### Reuse Switching's fold
* Bad, because that fold cycles dart by dart with no chain and no bull, and the rules need both.

### New exercise type with its own engine and a shared point function
* Good, because sharing the point function keeps the two exercises' scoring from drifting apart.

## Evidence / More Information
Decided: 2026-09-23

* `docs/superpowers/specs/2026-09-23-switching-target-scoring-exercise-design.md` (§ 1, § 3, § 4): rebuilt Decision Drivers, Considered Options and Consequences.
* Commit `fa812644` (PR #576, 2026-09-23; adds the D357 row): rebuilt Considered Options and Pros and Cons from the row's Reason.
* Commit `87c15cab` (2026-10-20, "refactor(training): erase switching target scoring"): rebuilt Confirmation.
* Superseded by D474, which erases this exercise type.
