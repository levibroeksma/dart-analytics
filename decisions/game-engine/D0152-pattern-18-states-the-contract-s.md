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

# Pattern 18 states the contract's undo depth

## Context and Problem Statement
All five engines already behaved this way and matched `main`, but nothing said so — a sixth engine had no rule to conform to (review M-undo-depth)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Pattern 18 states the contract's undo depth: unbounded, one `record()` per `undo()` call, back through rehydrated facts to an empty log, `false` when nothing remains", because All five engines already behaved this way and matched `main`, but nothing said so — a sixth engine had no rule to conform to (review M-undo-depth).

### Consequences
* Neutral, because the change adds no code: Pattern 18 states the undo depth the five engines already implement (commit `51d99be8`).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-26

* Commit `51d99be8` (2026-07-26; adds the D152 row): rebuilt Consequences. Its message says "Pattern 18 states the contract's undo depth: unbounded, one record() per call. No code change."
