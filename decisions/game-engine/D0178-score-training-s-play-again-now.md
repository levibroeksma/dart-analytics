---
id: D0178
status: accepted
date: 2026-08-01
origin: contemporaneous
original-date:
tags: [game-engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Score Training's "Play again" now threads the just-completed session's `durationValue`

## Context and Problem Statement
Before this fix, play-again silently reverted a custom duration (e.g. a 20-round or 12-minute session) back to the template default on every replay, contradicting the whole point of making duration configurable — a persisted-behavior change, not just new UI

## Decision Drivers
* `playAgain()` posted `source: "template"` with no overrides. A 25-round session replayed through Play again persisted a 10-round configuration server-side while the player played 25 (spec, Start flow / Play again).
* The spec treats that mismatch as a stored fact contradicting what happened, which breaks "Store what happened" and the intent of immutable configuration snapshots (spec, Start flow / Play again).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Score Training's "Play again" now threads the just-completed session's `durationValue` into the new session's `create` call as `overrides.duration_value`, instead of leaving the fresh session on the template's stored default".

### Consequences
* Good, because the persisted configuration matches the duration the player plays after a replay, for both a custom ROUNDS value and a custom MINUTES value.
* Neutral, because the play page changes only in `playAgain()`'s create payload: no play UI, engine or timer change (plan, Global Constraints).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/score-training-play.data.test.ts` asserts that the replay's `createSession` call carries `overrides: { duration_value }`, with custom values of 20, 25 and 12.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-01

* `docs/superpowers/specs/2026-07-31-score-training-configurable-duration-design.md` (Start flow / Play again, Revision log item 1): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-08-01-score-training-configurable-duration.md` (Goal, Global Constraints): rebuilt Consequences.
* Commit `2ee1c8b8` (2026-08-01; adds the D178 row): no section rebuilt.
