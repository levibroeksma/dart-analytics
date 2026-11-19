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
<!-- backfill: pending -->

# Score Training's "Play again" now threads the just-completed session's `durationValue`

## Context and Problem Statement
Before this fix, play-again silently reverted a custom duration (e.g. a 20-round or 12-minute session) back to the template default on every replay, contradicting the whole point of making duration configurable — a persisted-behavior change, not just new UI

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training's "Play again" now threads the just-completed session's `durationValue` into the new session's `create` call as `overrides.duration_value`, instead of leaving the fresh session on the template's stored default".

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
Decided: 2026-08-01
