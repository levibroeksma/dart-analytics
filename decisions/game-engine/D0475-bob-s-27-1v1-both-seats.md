---
id: D0475
status: accepted
date: 2026-10-19
origin: contemporaneous
original-date:
tags: [game-engine, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Bob's 27 1v1: both seats surviving the bull resolves by final score

## Context and Problem Statement
both seats ended `WON` with no match outcome, so the session stayed `IN_PROGRESS` and could be neither finished nor continued (#983). The score-compare rule is the repo's existing outcome for equal-footing survival, and the tie follows the deferred-tiebreak convention.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "in a 1v1 `BOBS27_V1` match where neither seat reaches 0 or below, the match completes when both seats finish the bull visit. The higher final score wins; equal scores end as `TIE` with no winning side. An elimination (a seat busting) still ends the match at once. `foldBobs27State` composes `scoreCompareOutcome` for this case, as Singles and Doubles Training do; `Bobs27State` and `Bobs27ResultsSnapshot` gain `TIE`.".

### Consequences
`docs/game-rules/rulesets/bobs-27.md` §Ends when states the rule. A tie is not persisted as a winner; the results title reads "It's a tie!".

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/bobs27.engine.module.test.ts` covers both outcomes: the higher final score wins, and equal scores end as `TIE` with no winner.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-19

* Commit `9520e80e` (2026-10-19, "resolve 1v1 when both seats survive the bull"; closes #983): adds the original ledger block. Its message states the rule and the stuck `IN_PROGRESS` state; no section rebuilt beyond Confirmation.
