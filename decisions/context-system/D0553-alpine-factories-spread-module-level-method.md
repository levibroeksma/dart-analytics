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

# Alpine factories spread module-level method groups; their key shape is pinned by test

## Context and Problem Statement
a factory returning one literal of state and methods is one function to fallow, 61 to 1,118 lines long; a module-level object of methods is not, and each method is then scored alone.

## Decision Drivers
* A factory returning one literal of state and methods counts as 1 function to fallow, 61 to 1,118 lines long.
* A module-level object of methods is not 1 function, so fallow scores each method alone.

## Considered Options
* Keep each factory as one literal of state and methods (the prior shape).
* Spread the methods from an unexported module-level constant (chosen).

## Decision Outcome
Chosen option: "an `x-data` factory keeps its state in the returned literal and spreads its methods from an unexported module-level constant in the same file, at the position the methods stood (`03-Alpine-Patterns.md` § Method groups). Getters, and methods that read a factory parameter or local, stay in the literal. 35 factories are converted; the method bodies are moved verbatim. `tests/support/factory-shape.ts` gives `shapeOf` (own keys in order, methods and accessors marked) and `sharedStateKeys` (object values identical on two instances); each converted factory's test snapshots both, and the snapshots were written against the code before the move.", because a factory returning one literal of state and methods is one function to fallow, 61 to 1,118 lines long; a module-level object of methods is not, and each method is then scored alone.

### Consequences
`large_functions_src` 87 → 55 and health score 88.7 → 92.0. Eleven factories and stores are not converted: their methods use the literal's own inferred `this`, which a separate constant cannot see without a hand-written context type (`gameStatsStore`, `routineStatsStore`, `replayStore`, `gameStore`, `profileStore`, `statsStore`, `starterStep`, `gameSessionList`, `quickSubtractPlay`, `scoreTrendSection`, `gameHeatmapSection`); `durationSetupData` (generic over its type parameter) and `pausedTipsData` (closure state) are also left. Group constants are named `<factory>Methods`, numbered when a factory has more than one run.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/support/factory-shape.ts` exports `shapeOf` and `sharedStateKeys`. Each converted factory's test snapshots both, and the snapshots were written against the code before the move. The `large_functions_src` benchmark row in `scripts/quality-benchmarks.json` tracks the function count.

## Pros and Cons of the Options
### Keep each factory as one literal
* Bad, because fallow counts the whole literal as 1 function, 61 to 1,118 lines long.

### Spread the methods from a module-level constant
* Good, because fallow scores each method alone.
* Bad, because 11 factories and stores keep the literal: their methods use its inferred `this`, which a separate constant cannot see without a hand-written context type.

## Evidence / More Information
Decided: 2026-11-10

* Commit `69ccbfc2` (PR #1318, adds the D553 row, `app/tests/support/factory-shape.ts` and the 35 factory conversions): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
