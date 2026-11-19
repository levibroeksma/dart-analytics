---
id: D0356
status: accepted
date: 2026-09-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Target Scoring is its own exercise type, not a Switching configuration; its scoring is locked in the engine

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/target-scoring.md`) need the bull as a target, which `SWITCHING_V1` rejects because every Switching dart aims at a treble (D297); a chain that resets on a miss and advances only a live chain is also a different fold from Switching's dart-by-dart cycle. The author locked the scoring, so exposing it as configuration would admit tables the rules forbid.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`TARGET_SCORING` / `TARGET_SCORING_V1` is a new exercise type (seed `0023`) with its own `DartExerciseEngine` (`target-scoring.engine.module.ts`). Its configuration is `targets` alone — distinct board targets, `1`–`20` or `25`; the point table (single 1, treble 3, double a miss; outer bull 1, bullseye 3) lives in the engine, not in configuration. Each dart's intended zone is `TREBLE` on a number and `INNER_BULL` on the bull. One turn is one three-dart visit regardless of target changes. V1 is a routine step only: it reaches players through the routine builder's catalog, with no seeded routine and no standalone page.".

### Consequences
adding a target is a template/step configuration edit — nothing in the engine names 20/19/18. A future variant with different point values is a new ruleset version, not a config key. Standalone play stays deferred (rules doc `Standalone entry`, V2+).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-23
