---
id: D0553
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Alpine factories spread module-level method groups; their key shape is pinned by test

## Context and Problem Statement
a factory returning one literal of state and methods is one function to fallow, 61 to 1,118 lines long; a module-level object of methods is not, and each method is then scored alone.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "an `x-data` factory keeps its state in the returned literal and spreads its methods from an unexported module-level constant in the same file, at the position the methods stood (`03-Alpine-Patterns.md` § Method groups). Getters, and methods that read a factory parameter or local, stay in the literal. 35 factories are converted; the method bodies are moved verbatim. `tests/support/factory-shape.ts` gives `shapeOf` (own keys in order, methods and accessors marked) and `sharedStateKeys` (object values identical on two instances); each converted factory's test snapshots both, and the snapshots were written against the code before the move.", because a factory returning one literal of state and methods is one function to fallow, 61 to 1,118 lines long; a module-level object of methods is not, and each method is then scored alone.

### Consequences
`large_functions_src` 87 → 55 and health score 88.7 → 92.0. Eleven factories and stores are not converted: their methods use the literal's own inferred `this`, which a separate constant cannot see without a hand-written context type (`gameStatsStore`, `routineStatsStore`, `replayStore`, `gameStore`, `profileStore`, `statsStore`, `starterStep`, `gameSessionList`, `quickSubtractPlay`, `scoreTrendSection`, `gameHeatmapSection`); `durationSetupData` (generic over its type parameter) and `pausedTipsData` (closure state) are also left. Group constants are named `<factory>Methods`, numbered when a factory has more than one run.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
