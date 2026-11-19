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
<!-- backfill: pending -->

# `ROUNDS` batch validation checks the turn-count limit per seat, not per session

## Context and Problem Statement
The old check summed turns across every seat and compared that to the single-seat budget, so any 2-seat ROUNDS session's legitimate combined turn count (up to 2×`duration_value`) tripped the "exceeds limit" rejection — always, at or before the real finish. Solo sessions never hit this (one seat's turns are the whole session's turns), which is why it shipped unnoticed until 1v1 (issue #169).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`duration_type: "ROUNDS"`'s `duration_value` is a per-seat budget — every seat plays out its own full round count before a match is decided (`durationSeatComplete`, `modules/game/seat-state.module.ts`). The shared batch-validation check (`exceedsRoundsLimit`, `quick-score.validator.ts`, used by Score Training and TUOD) now checks each participant's own existing-plus-batch turn count against `duration_value` independently, via a new `ExistingTurnCounts` map (`app/src/repositories/interfaces.ts`) keyed by participant id instead of one session-wide number.".

### Consequences
`RulesetValidator.validateBatch`'s `existingTurnCount: number` field is renamed `existingTurnCounts: ExistingTurnCounts` — a breaking signature change for every ruleset validator, though only Score Training's and TUOD's `validateBatch` read the value; the rest carry the field only to satisfy the interface. `countTurnsForSession` (`session.repository.ts`) returns a per-participant map instead of a scalar.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-27
