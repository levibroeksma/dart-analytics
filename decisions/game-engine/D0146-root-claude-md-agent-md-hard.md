---
id: D0146
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain an engine-only task scope rule

## Context and Problem Statement
Two engines shipped keeping only a derived score and discarding the per-dart facts needed to persist them, and a third emitted an intention pair a schema CHECK rejects, none caught until the fifth PR's review (C1, C2, I1, I2)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain an engine-only task scope rule: the spec must name the capture/input mode, stage type, and `turns`/`darts` mapping — proving the state shape can be persisted — before implementation; deferring persistence is allowed, an unpersistable shape is not".

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
