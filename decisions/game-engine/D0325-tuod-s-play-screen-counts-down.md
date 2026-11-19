---
id: D0325
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, checkout, 501, Score Training, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# TUOD's play screen counts down the open attempt, not the ladder rung

## Context and Problem Statement
Issue #202 — under ANALYTICS + VISUAL_BOARD a TUOD player throws three darts and the screen never changes, because the only number shown is a ladder rung that by rule moves once per attempt. Every other visual-board ruleset already gives per-dart feedback: 501 and 121 count a remainder down, Score Training accumulates its total, and the five `VisitPreview` games tick each dart hit or miss. 121's fold is the exact precedent — an open-visit overlay onto one field, with the ladder position kept as a separate stat row — so TUOD is brought onto it rather than given a shape of its own. The overlay reads the open turn's darts rather than its `totalScore`, which 121 can use because 121 stamps a running total per dart and TUOD deliberately does not: a TUOD turn's `totalScore` is the success signal the ladder folds on (`> 0`), so writing a running value into it would count a half-thrown attempt as a success.

## Decision Drivers
* Under ANALYTICS + VISUAL_BOARD a TUOD player throws three darts and nothing on screen changes, because the ladder rung moves once per attempt (issue #202, commit message).
* A TUOD turn's `totalScore` is the success signal the ladder folds on (`> 0`), so a running value cannot go into it (row Reason).
* 121's open-visit overlay is the precedent for per-dart feedback (commit message).

## Considered Options
* Add `remainingInAttempt` to `TuodSeatState`, folded as `currentTarget` minus the open turn's dart scores, following 121's overlay (chosen).
* Write a running value into the turn's `totalScore`, as 121 does (not usable for TUOD, because it would count a half-thrown attempt as a success).

## Decision Outcome
Chosen option: "`TuodSeatState` gains `remainingInAttempt`, folded by `foldTuodState` as `currentTarget` minus the open turn's dart scores and equal to `currentTarget` whenever no attempt is open. The play screen's big number and the 1v1 scoreboard read it instead of `currentTarget`, which moves to a `Target` stat row beside them, and `checkoutHintFor` re-routes off the live remaining with `isCheckoutReachable` gating on the darts that seat has left. The ladder itself is untouched: only closed turns move `currentTarget`, and `totalScore` still stays 0 until `settleVisit` decides the attempt.".

### Consequences
`TuodSeatState` widens, so every exact-shape assertion over it changes; `statsFor` and the results modal still read `currentTarget` and are unaffected. The checkout hint now blanks once no route fits the darts left, where before it always printed the ladder target's route. TUOD's DartBot still aims every visual-board dart at `currentTarget` rather than the live remainder — a separate defect (issue #478), deliberately not fixed here.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/tuod.engine.module.test.ts` and `app/tests/lib/game/tuod-play.data.test.ts` cover `remainingInAttempt`.

## Pros and Cons of the Options
### `remainingInAttempt` overlay
* Good, because the play screen changes with every dart of an open attempt.
* Good, because the ladder is untouched: only closed turns move `currentTarget`, and `totalScore` stays 0 until `settleVisit` decides the attempt.

### Running value in `totalScore`
* Bad, because it would count a half-thrown attempt as a success.

## Evidence / More Information
Decided: 2026-09-19

* Commit `e023edf0` (2026-09-19, for issue #202, adds the D325 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from its message and the row's Reason. It also added the tests named in Confirmation.
