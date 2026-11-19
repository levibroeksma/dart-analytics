---
id: D0488
status: superseded
date: 2026-10-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0506
---
<!-- backfill: pending -->

# A marks engine's class and factory are typed by the same ruleset key

## Context and Problem Statement
the D487 factory took the key and the built engine independently, so the two could disagree and only the wiring gate's grep caught a missing literal, not a mismatched one.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`CricketEngine` and `TacticsEngine` are generic in their ruleset key (`TKey`), `MarksEngine.fork()` returns the engine type, and `marksEngineFactory` requires `build` to return an engine whose key is the factory's own (`NoInfer`). A factory keyed `CRICKET_V2` that builds a V1-keyed engine fails to type-check.", because the D487 factory took the key and the built engine independently, so the two could disagree and only the wiring gate's grep caught a missing literal, not a mismatched one.

### Consequences
type-level only, no behaviour change. `new CricketEngine(config)` still defaults to V1. Regression guards are `@ts-expect-error` tests in `marks-engine.module.test.ts` and `tactics.engine.module.test.ts`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-24
