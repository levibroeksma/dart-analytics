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

# Engines import `NO_INTENT` from `turn-log.module`

## Context and Problem Statement
Shanghai kept a local copy identical to the shared constant (#1244); two definitions of "no intention" can drift apart.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "an engine that records no aimed target returns the `NO_INTENT` exported by `modules/game/turn-log.module.ts`; no engine declares its own copy.", because Shanghai kept a local copy identical to the shared constant (#1244); two definitions of "no intention" can drift apart.

### Consequences
`shanghai.engine.module.ts` imports the shared constant; a change to the pair is made in one place.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-06

* Commit `b0fded68` adds the D531 row; it rebuilt no section.
