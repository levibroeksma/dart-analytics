---
id: D0153
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, checkout, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Ten Up One Down ships as the sixth engine on the `GameEngine` contract

## Context and Problem Statement
`TUOD_V1` was seeded with two presets but had no schema, engine or validator, so it listed in the preset picker and could not start a session (whole-branch review, Minor)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Ten Up One Down ships as the sixth engine on the `GameEngine` contract: `TuodConfig` (`.strict()`, matching both seeded presets key-for-key), `TuodEngine` (RECREATIONAL + QUICK_SCORE, one `EXERCISE_BLOCK`, one turn per attempt carrying the checked-out target or `0`, ladder folded from those turns), and `tuodValidator`. Success requires the finishing dart to be a double, never a count of darts thrown at one; a bust is a failed attempt. V1 ships no ladder floor, so `record()` refuses a checkout claimed on a target below 2 rather than inventing one. The three quick-score validators' shared batch rules move to `services/rulesets/quick-score.validator.ts`", because `TUOD_V1` was seeded with two presets but had no schema, engine or validator, so it listed in the preset picker and could not start a session (whole-branch review, Minor).

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26
