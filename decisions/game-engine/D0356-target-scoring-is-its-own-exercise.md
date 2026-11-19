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

# Target Scoring is its own exercise type, not a Switching configuration; its scoring is locked in the engine

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/target-scoring.md`) need the bull as a target, which `SWITCHING_V1` rejects because every Switching dart aims at a treble (D297); a chain that resets on a miss and advances only a live chain is also a different fold from Switching's dart-by-dart cycle. The author locked the scoring, so exposing it as configuration would admit tables the rules forbid.

## Decision Drivers
* The scoring is locked by the rules document ("Shown, locked"), so it is not configuration (spec § 3).

## Considered Options
* A new `TARGET_SCORING` exercise type with its own engine and the point table in the engine (chosen).
* A Switching configuration, with the scoring exposed as config (rejected).

## Decision Outcome
Chosen option: "`TARGET_SCORING` / `TARGET_SCORING_V1` is a new exercise type (seed `0023`) with its own `DartExerciseEngine` (`target-scoring.engine.module.ts`). Its configuration is `targets` alone — distinct board targets, `1`–`20` or `25`; the point table (single 1, treble 3, double a miss; outer bull 1, bullseye 3) lives in the engine, not in configuration. Each dart's intended zone is `TREBLE` on a number and `INNER_BULL` on the bull. One turn is one three-dart visit regardless of target changes. V1 is a routine step only: it reaches players through the routine builder's catalog, with no seeded routine and no standalone page.".

### Consequences
adding a target is a template/step configuration edit — nothing in the engine names 20/19/18. A future variant with different point values is a new ruleset version, not a config key. Standalone play stays deferred (rules doc `Standalone entry`, V2+).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/target-scoring.engine.module.test.ts`, `target-scoring.golden.test.ts` and `target-scoring.aimed.golden.test.ts` in the same directory cover the engine. `app/tests/services/exercise-rulesets/target-scoring.validator.test.ts` covers the validator.

## Pros and Cons of the Options
### Own exercise type with locked scoring
* Good, because the bull can be a target, and the chain fold is its own.
* Good, because the locked point table cannot be edited into tables the rules forbid.

### Switching configuration
* Bad, because `SWITCHING_V1` rejects the bull, since every Switching dart aims at a treble.
* Bad, because exposing the scoring as configuration would admit tables the rules forbid.

## Evidence / More Information
Decided: 2026-09-23

* `docs/superpowers/specs/2026-09-23-target-scoring-exercise-design.md` (§ 1–4): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Commit `25628436` (2026-09-23, adds the D356 row): Target Scoring exercise, seed `0023`, with its tests.
