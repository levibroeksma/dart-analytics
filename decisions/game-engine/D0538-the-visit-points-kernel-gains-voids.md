---
id: D0538
status: accepted
date: 2026-11-08
origin: contemporaneous
original-date:
tags: [game-engine, Score Training, leg, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The Visit points kernel gains `voids` and `goal`; Fives V1 is the first caller

## Context and Problem Statement
Visit-points spec V2: a rule lands with its first caller. Fives needs exact-goal, void and bust; no new dart fact is needed because every on-board dart scores at least 1.

## Decision Drivers
* The Visit points kernel carries only what its shipped engines use; each goal, bust or void setting lands with the first game that needs it (visit-points spec V2).
* Score Training and Score Threshold fold exactly as before, with goldens byte-identical (plan call F4).
* The Fives rules need a void on any off-board dart and a bust on overshoot, counted apart (plan calls F1, F5).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`VisitPointsRules` gains optional `voids(darts)` (a closed visit that books no points whatever its total) and `goal` (a closed visit whose points would take the seat above it is a bust and books nothing). `VisitPointsSeat` gains `voids`, `busts` and `scoringVisits`. A dart with board score 0 is off the board, so Fives voids a visit on any score-0 dart. The leg ends the moment a seat reaches 51, so seat 1 has a first-throw edge. An off-board dart is a `MISS` zone dart with no landing coordinate. A void and a bust are counted apart; a total not divisible by 5 is a plain zero.", because Visit-points spec V2: a rule lands with its first caller. Fives needs exact-goal, void and bust; no new dart fact is needed because every on-board dart scores at least 1.

### Consequences
Score Training and Score Threshold set neither rule and fold as before. Fives is a `SHARED`-leg `DartGameSpec`, 2–4 seats, darts only (QUICK_SCORE cannot show an off-board dart).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/visit-points-kernel.module.test.ts` and `app/tests/modules/game/fives.engine.module.test.ts` cover voids, busts and the unchanged fold when neither rule is set (plan Review Focus 8).

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-08

* `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (V2): rebuilt Decision Drivers.
* `docs/superpowers/plans/2026-11-08-fives-v1.md` (calls F1-F8, Review Focus 8): rebuilt Decision Drivers and Confirmation.
* Commit `d2817ce3` (2026-11-08): adds the original ledger block.
