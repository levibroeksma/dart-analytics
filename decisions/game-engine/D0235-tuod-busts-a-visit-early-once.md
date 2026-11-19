---
id: D0235
status: accepted
date: 2026-08-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, checkout, 501, leg, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# TUOD busts a visit early once its last permitted dart cannot land on any double

## Context and Problem Statement
Issue #161 reported that missing dart 2 for an odd remainder (e.g. a target of 41, two singles leaving 39) still made the player throw a mathematically pointless 3rd dart before the visit closed. This is a TUOD-specific ladder-game UX choice, not a general darts-scoring rule — 501 and 121 share the same `visitOutcome`-shaped bust logic verbatim and are deliberately left unchanged, since a real 501/121 leg still requires all darts to be physically thrown regardless of whether checkout remains mathematically possible.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`tuod.engine.module.ts`'s `visitOutcome()` gains a third bust condition alongside overshoot / remaining-exactly-1 / reached-0-without-a-double: when exactly one dart remains in the visit and the target still remaining is odd (and greater than 1), the visit busts immediately instead of waiting for that last dart to be thrown. Every double scores an even number, so an odd remainder can never be checked out on the last dart regardless of where it lands. `settleVisit()` and `wouldCompleteDart()` both now pass a `dartsRemaining` argument (`maxDartsPerTurn` minus darts already thrown in the visit) into the shared `visitOutcome()` so the rule is written once.".

### Consequences
A visit that goes bust on dart 2 now stamps `completedAt` and closes without a 3rd dart ever being recorded — `TuodEngine.record()`/`recordDart()` simply never receive it, since the board UI's own finish-confirm gate (`wouldCompleteDart`) already reflects the same rule. Two regression tests were added to `tuod.engine.module.test.ts` (`describe("TuodEngine.record — dart-by-dart (VISUAL_BOARD)")` and `describe("TuodEngine.wouldComplete — dart path, pure")`) covering the odd-remainder-after-dart-2 bust and confirming dart 1 alone never busts early. No existing test was re-pointed at a different input.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-26
