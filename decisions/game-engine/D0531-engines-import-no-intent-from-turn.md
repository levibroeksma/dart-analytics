---
id: D0531
status: accepted
date: 2026-11-06
origin: contemporaneous
original-date:
tags: [game-engine, engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Engines import `NO_INTENT` from `turn-log.module`

## Context and Problem Statement
Shanghai kept a local copy identical to the shared constant (#1244); two definitions of "no intention" can drift apart.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "an engine that records no aimed target returns the `NO_INTENT` exported by `modules/game/turn-log.module.ts`; no engine declares its own copy.", because Shanghai kept a local copy identical to the shared constant (#1244); two definitions of "no intention" can drift apart.

### Consequences
`shanghai.engine.module.ts` imports the shared constant; a change to the pair is made in one place.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-06
