---
id: D0539
status: accepted
date: 2026-11-08
origin: contemporaneous
original-date:
tags: [game-engine, engine, leg, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Fives stores an off-board dart as a `MISS` dart with or without a coordinate; its stage is an `EXERCISE_BLOCK`

## Context and Problem Statement
Review of the engine PR. D538 said a Fives off-board dart has no landing coordinate and the rules doc said a shared `LEG`; `board-input.module.ts` stores the tap position of an off-ring dart and the game shell opens an `EXERCISE_BLOCK` stage.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "An off-board Fives dart is a `MISS` zone dart with score 0. Under VISUAL_BOARD a tap outside the double ring keeps the coordinate the board read; a bounce-out has none. Either voids the visit. The game's one shared stage is written as an `EXERCISE_BLOCK`, not a `LEG`.".

### Consequences
Voiding reads the dart's score, so it is unaffected. The rules doc and capture section now match the code.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-08
Supersedes: none. Narrows D538's "no landing coordinate" clause.
