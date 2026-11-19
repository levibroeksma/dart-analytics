---
id: D0462
status: accepted
date: 2026-10-16
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, scoring, checkout, 501, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Dart engines are specs bound to a shared shell

## Context and Problem Statement
every dart engine repeated ~100–150 lines of identical class shell around its pure fold; the shell is L2 of the rule-kernels design (`docs/superpowers/specs/2026-10-15-rule-kernels-design.md`), which family kernels plug into.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "single-stage, dart-input game engines are a `DartGameSpec` bound to `dart-engine-shell.module.ts`; clockless timed dart exercises a `DartExerciseSpec` bound to `dart-exercise-shell.module.ts`. Shipped engines migrate one per PR, proven by a differential oracle against a frozen legacy copy, then locked by golden snapshots. Doubles Training, Bob's 27 and Target Scoring migrated first. Each engine stays a named class (`class X extends dartGameEngineClass(spec) {}`) so it is both value and type and `instanceof` narrows; the spec contracts live in the `interfaces.ts` barrels.".

### Consequences
Pattern 18, `09-Adding-A-Game.md` and both engine scope guides name the shell. Multi-stage (121, TUOD, 501) and visit-input engines stay hand-written until the Checkout and Visit-points plans extend the shell. `GameEngine` and `DartExerciseEngine` stay separate contracts (D264).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-16
