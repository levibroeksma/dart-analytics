---
id: D0528
status: accepted
date: 2026-11-05
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, checkout, Score Training, undo, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Scored-batch validation, four exercise engines, track scoring rules, seated refusal and the session row head are shared

## Context and Problem Statement
the last seven clone groups in the D513 baseline. Variation is data or a callback. The one boolean, `limitOnVisualBoard`, keeps TUOD's rounds limit on the quick-score path only, as it was; Score Training applies it on both.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`validateScoredBatch(input, options)` (`services/rulesets/scored-batch.validator.ts`; `ScoredBatchOptions` in `rulesets/types.ts`: `maxTurnScore`, `limitNoun`, `limitOnVisualBoard`) is the one `validateBatch` behind Score Training and TUOD. Bull Up, Bullseye Checkout, Double Pattern and Switching are `DartExerciseSpec`s bound to `dart-exercise-shell.module.ts`; exports and fold signatures are unchanged. Visit close per engine: Bull Up `() => false` (one dart per turn); Bullseye Checkout `turn.darts.length < DARTS_PER_VISIT`; Double Pattern and Switching derive it from the folded state, Double Pattern also from the turn's `completedAt` (`turn.completedAt === null && state.targetWithinPattern !== 0`; `state.targetIndex !== 0`), because the shell passes no config to `isVisitOpen`. `scoringTrackRules(config, onDart, doneMessage)` (`target-scoring.engine.module.ts`) builds the `TrackRules` of Target Scoring (`chainOnTarget`) and Switching Chain (`resetOnMiss`). `seatedRefusal(matchEnded, seatDone)` (`seat-state.module.ts`) and `visitOpenUnder(darts)` (`turn-log.module.ts`) back Bob's 27, Singles Training and Shanghai; Baseball takes `visitOpenUnder` only. `statistics.repository.ts` maps the shared session-row head of its two page queries through an unexported `mapSessionHead`.".

### Consequences
proven by characterization tests written and green on the old code first, never rewritten after: golden snapshots per migrated exercise engine (seeded trace with undo, rehydration, `expireTimer()` and resume; a scripted refusal and expiry undo; a `prior`-facts resume against a continuous run), parity tables on both validators, and shape, key-order and error-precedence pins on both mappers. Accepted difference: the state-derived visit close (Double Pattern, Switching) equals the old dart-count rule for every log the engine writes, but would split a hand-made `prior` log that is misaligned with pattern or pass boundaries differently; Bull Up's `() => false` is the old engine's own predicate, so its visits close identically for every log. `scoringTrackRules` takes `doneMessage` because the two engines' messages differ. Baseball keeps its own refusal (one status check). Bullseye Checkout, Double Pattern and Switching stay kernel `PENDING` in `scripts/engine-kernels.txt`: shell-bound now, kernel binding left for a kernel wave. Whether TUOD's quick-path-only limit is intended is not judged here. Left open: the optional `respond()` route helper (owner's call). Baseline 7 → 0 rows; `scripts/dupes-baseline.txt` is empty. Plan: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4c.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-05
Supersedes: none. Extends D513, D527.
