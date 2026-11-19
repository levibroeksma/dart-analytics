---
id: D0142
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Persistence semantics fixed for every game

## Context and Problem Statement
Storing game points or a negative turn total in shared columns silently corrupts every cross-game aggregation (review I5)

## Decision Drivers
* `darts.score` is CHECK >= 0 (migration `0006`), and `turns.total_score` is documented as a controlled denormalisation of the sum of dart scores (review I5).
* Singles Training points of 1/2/3 are not board scores, and they derive from `hit_target_number` and `hit_zone_id` (review I5).

## Considered Options
* Fix the semantics: board score per dart, non-negative sum per turn (chosen).
* Store game-specific values in the shared columns: Bob's 27 penalty as a negative turn total, Singles points as dart scores.

## Decision Outcome
Chosen option: "Persistence semantics fixed for every game: `darts.score` is the dart's actual board score, never a game-specific point value; `turns.total_score` is the sum of counted dart board scores — `0` for a void visit, never negative — so Bob's 27's full-miss penalty and Singles Training's 1/2/3 points are derived, never written", because Storing game points or a negative turn total in shared columns silently corrupts every cross-game aggregation (review I5).

### Consequences
* Bad, because under `RECREATIONAL` + `QUICK_SCORE` a 501 bust and a genuine zero-scoring visit both persist as `turns.total_score = 0` with no dart rows. The plan records that bust rate is not computable.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/bobs27.engine.module.test.ts` asserts a full-miss visit never writes a negative turn total. `app/tests/modules/game/singles-training.engine.module.test.ts` asserts dart facts carry the board score, never the training points.

## Pros and Cons of the Options
### Board score per dart, non-negative turn sum
* Good, because Bob's 27 and Singles values derive from facts and belong in views (Pattern 9).
* Bad, because a 501 bust and a zero-scoring visit are indistinguishable in the persisted model.

### Game-specific values in shared columns
* Bad, because a negative turn total violates the documented denormalisation of `turns.total_score`.
* Bad, because Singles points of 1/2/3 would silently corrupt any cross-game aggregation (review I5).

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 2 I5): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (Task 6 persistence rule, Task 7, Task 13 steps 3b and 4): rebuilt Consequences.
* Commit `8e46e453` (2026-07-26; "docs: record the game engine contract and persistence semantics"): adds the D142 row.
* Applied in: `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`, `docs/superpowers/plans/2026-08-12-bobs27-phase1-scoring-fix.md`.
