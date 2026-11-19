---
id: D0239
status: accepted
date: 2026-08-27
origin: contemporaneous
original-date:
tags: [api, batch, session, validation]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `ROUNDS` batch validation checks the turn-count limit per seat, not per session

## Context and Problem Statement
The old check summed turns across every seat and compared that to the single-seat budget, so any 2-seat ROUNDS session's legitimate combined turn count (up to 2×`duration_value`) tripped the "exceeds limit" rejection — always, at or before the real finish. Solo sessions never hit this (one seat's turns are the whole session's turns), which is why it shipped unnoticed until 1v1 (issue #169).

## Decision Drivers
* `duration_value` under `duration_type: "ROUNDS"` is a per-seat budget: `durationSeatComplete` checks each seat's own `turnCount`, and the engine plays out each seat's full budget.
* The old session-wide check always tripped for 2-seat sessions, at or before the legitimate finish.

## Considered Options
* Check each participant's own turn count against `duration_value` (chosen).
* Keep the session-wide turn count (the prior behaviour).

## Decision Outcome
Chosen option: "`duration_type: "ROUNDS"`'s `duration_value` is a per-seat budget — every seat plays out its own full round count before a match is decided (`durationSeatComplete`, `modules/game/seat-state.module.ts`). The shared batch-validation check (`exceedsRoundsLimit`, `quick-score.validator.ts`, used by Score Training and TUOD) now checks each participant's own existing-plus-batch turn count against `duration_value` independently, via a new `ExistingTurnCounts` map (`app/src/repositories/interfaces.ts`) keyed by participant id instead of one session-wide number.".

### Consequences
`RulesetValidator.validateBatch`'s `existingTurnCount: number` field is renamed `existingTurnCounts: ExistingTurnCounts` — a breaking signature change for every ruleset validator, though only Score Training's and TUOD's `validateBatch` read the value; the rest carry the field only to satisfy the interface. `countTurnsForSession` (`session.repository.ts`) returns a per-participant map instead of a scalar.
* Good, because a 1v1 Score Training or TUOD session no longer fails to save at match completion.
* Neutral, because a participant absent from `ExistingTurnCounts` counts as 0 existing turns.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/rulesets/quick-score.validator.test.ts` covers `exceedsRoundsLimit`, including a 1v1 batch that is under each seat's budget but over it combined, and an absent participant.

## Pros and Cons of the Options
### Per-seat check
* Good, because solo and 1v1 sessions both pass at their legitimate finish.

### Session-wide count (prior behaviour)
* Bad, because it rejected any 2-seat ROUNDS session at or before the real finish, and solo sessions hid the defect until 1v1.

## Evidence / More Information
Decided: 2026-08-27

* `docs/superpowers/specs/2026-08-27-score-training-rounds-limit-seat-fix-design.md` (Problem, Root cause, Design, Testing): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-08-27-score-training-rounds-limit-seat-fix.md` (Task 2): the ledger text.
* Commit `2352aafb` (2026-08-27, adds the D239 row).
