---
id: D0281
status: accepted
date: 2026-09-15
origin: contemporaneous
original-date:
tags: [api, batch, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A turn-less batch needs no capture pair, so Warm-Up's `EXERCISE_SECTION` stages upload through the same batch route

## Context and Problem Statement
issue #309 — Warm-Up's phase-by-phase record was computed in memory (`WarmUpEngine.advance()`) but never uploaded: `uploadCurrentStepFacts` only ever read `activeDartEngine()` (Switching/Double Pattern), so its call was always a no-op for a Warm-Up step, and the session was marked `COMPLETED` with zero persisted stages — contradicting root `CLAUDE.md`'s "store what happened". D277 (2026-09-14) had just re-affirmed that a Warm-Up batch "still returns `INTERNAL_ERROR`", reasoning from "a capture pair remains mandatory for any batch" — true for a batch that writes a dart, but stricter than the actual constraint: a batch with no turn carries nothing a capture pair or ruleset validator could check.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`validateBatchAgainstRuleset` (`session.service.ts`) now checks whether the batch carries any turn at all (`batch.stages.some((stage) => stage.turns.length > 0)`) before requiring a capture pair. A turn-less batch is admitted on `appendBatch`'s structural checks alone, with no capture-pair check and no ruleset lookup — there is no dart in it to validate. A batch carrying a turn still requires `session.captureModeKey`/`inputModeKey`, unchanged. Client-side, `uploadCurrentStepFacts` (`balanced-training-play.data.ts`) now uploads `this.activeDartEngine() ?? this.warmUpEngine`, so a completed or abandoned Warm-Up step's `WarmUpEngine.facts()` — one `EXERCISE_SECTION` stage per phase entered, `turns: []` — reaches the server the same way Switching's and Double Pattern's dart facts already do.".

### Consequences
Warm-Up's `EXERCISE_SECTION` stages are now real rows in `stages`, one per phase entered, with no owning `turns`. The existing test asserting `INTERNAL_ERROR` for a Warm-Up session (`session.service.test.ts`) keeps passing unchanged — its batch fixture carries a turn, so it still exercises the capture-pair requirement, now correctly scoped to turn-carrying batches only.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-15
Supersedes: D277 (narrows its "a capture pair remains mandatory for any batch" clause to batches that carry a turn).
