---
id: D0151
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, 501, Score Training, undo, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `TurnFact.completedAt` is nullable and stamped when the visit resolves, not when it opens

## Context and Problem Statement
`06-Spec/04-Runtime-Layer.md` defines the column as the client-observed *end* of the visit; stamping at creation recorded when the turn opened, and migration `0015` had removed the ordering check that would have caught it

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`TurnFact.completedAt` is nullable and stamped when the visit resolves, not when it opens — 3rd dart for Bob's 27 / Singles, hit-or-3rd-miss for Doubles, immediately for the visit-per-record games (Score Training, 501); `undo()` clears it when it reopens a visit".

### Consequences
* Good, because `undo()` stays an exact inverse over `facts()`: it clears `completedAt` when it reopens a visit (commit `51d99be8`).

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

* Commit `51d99be8` (2026-07-26; adds the D151 row): rebuilt Consequences. Its message states: "completedAt is nullable and stamped at visit resolution, cleared when undo() reopens a visit; undo() stays an exact inverse over facts()."
