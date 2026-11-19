---
id: D0256
status: superseded
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, 501, leg, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0338
---
<!-- backfill: pending -->

# `double-attempt.module.ts` classifies dart-level double-attempt accuracy for 501/TUOD/121, replacing their leg/round-level checkout stats

## Context and Problem Statement
Rationale unknown — backfill pending.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "501's `checkoutPercentage` (`legsWon / (legsWon + checkoutAttemptCount)`) and TUOD's `attempts`/`successes`/`failures` both measured whole legs/rounds, not darts -- a won leg with zero busted visits reads 100% regardless of how many individual darts missed a double, and 121 had no checkout stat at all. Added `modules/game/double-attempt.module.ts`, classifying each dart against the double its remaining score needed at the moment it was thrown: eligible only when that remaining score is directly finishable by one dart (even and ≤40, or exactly 50); a double/bull hit is a hit or miss depending on whether it actually checked out; a single/treble hit counts as a miss only when it lands on the same or a board-adjacent segment (reusing `SECTOR_ORDER` from `board-geometry.module.ts`) to the required double; anything else (an unrelated single/treble, or a coordinate-less bounce-out) is excluded entirely -- a deliberate lay-up/reroute, never fabricated as a miss. Deliberately does not store or guess *which* double a player intended (D06's Singles Training precedent: naming an intent the player never held corrupts the analysis) -- only the geometric fact of where the dart landed relative to what the remaining score required.".

### Consequences
501's `FiveOhOneSeatResult.checkoutPercentage` and TUOD's `attempts`/`successes`/`failures` are removed, replaced by `doubleAccuracy: string | null` (null outside VISUAL_BOARD capture, same gating `checkoutAttemptCount` used). 121 gains `doubleAccuracy` as a new field. A persisted view, `v_double_out_checkout_darts` (migration `0024`), covers 501 history reads only -- TUOD/121's remaining-before-dart needs their ladder fold (`foldTuodState`/`foldOneTwentyOneState`), which is game-engine logic and does not belong in SQL (`05-Views.md`); their persisted reads are deferred to a future application-layer replay. Full design: `docs/superpowers/specs/2026-09-05-double-out-checkout-accuracy-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-05
