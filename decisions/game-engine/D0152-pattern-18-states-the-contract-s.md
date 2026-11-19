---
id: D0152
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Pattern 18 states the contract's undo depth

## Context and Problem Statement
All five engines already behaved this way and matched `main`, but nothing said so — a sixth engine had no rule to conform to (review M-undo-depth)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Pattern 18 states the contract's undo depth: unbounded, one `record()` per `undo()` call, back through rehydrated facts to an empty log, `false` when nothing remains", because All five engines already behaved this way and matched `main`, but nothing said so — a sixth engine had no rule to conform to (review M-undo-depth).

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
