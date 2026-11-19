---
id: D0279
status: accepted
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, stores, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0269
superseded-by:
---

# Balanced Training's Finishing step seats TUOD's snapshot on the step's own participant and converts it through `toSnapshot`

## Context and Problem Statement
the routine step's configuration arrives snake_case (`starting_target`, `duration_type`, …) exactly as the seed stores it, while every client snapshot and `TuodSnapshot` is camelCase, and `foldTuodState` maps over `config.seats` and then asks `seat-rota.module.ts`'s `activeSeat` for the active one — with no seats, `pool[facts.turns.length % pool.length]` indexes an empty array and `.participantRef` throws. `state()` therefore threw on every evaluation, and the `x-if` guarding TUOD's target display (`(state()?.seats.length ?? 1) < 2`) threw with it, so the Finishing step rendered the board input panel with no target section at all — the reported symptom. `maybeResumeCountdown` likewise read `config.durationType` as `undefined` and never started the step's own MINUTES countdown. `toSnapshot` is the codec every setup screen already uses for this conversion and validates the config against the ruleset's Zod schema on the way through. The commit message states the same change: the Finishing step converts its config through `toSnapshot` and seats it on the step's participant, so TUOD's `state()` folds instead of throwing and the target section renders.

## Decision Drivers
* `state()` threw on every evaluation when the snapshot had no seats, because `activeSeat` indexed an empty array.
* The step configuration arrives snake_case, while every client snapshot is camelCase, so `config.durationType` read as `undefined` and the countdown never started.
* `toSnapshot` is the codec every setup screen already uses, and it validates against the ruleset's Zod schema.

## Considered Options
* Spread the raw step configuration with `seats: []` (the earlier behaviour).
* Build `configSnapshot` through `toSnapshot("TUOD_V1", ...)` plus a one-entry `seats` array (chosen).

Rationale unknown — no source found for any further option.

## Decision Outcome
Chosen option: "`startFinishingStep()` builds `configSnapshot` as `toSnapshot("TUOD_V1", result.configuration)` plus a one-entry `seats` array carrying the step's own participant (`participantRef` from `result.participant.ref`, `displayName`, `sideKey: "A"`, `participantTypeKey: "PLAYER"`), instead of spreading the raw step configuration with `seats: []`.".

### Consequences
supersedes the `seats: []` half of D269 — the rest of that decision (reusing the unmodified TUOD play UI through the real global `$store.game`) stands unchanged. The Finishing step now runs its own 10-minute countdown, as a standalone TUOD MINUTES session does. A step configuration that fails the TUOD schema now throws inside `startFinishingStep()` and surfaces as the routine's own start error rather than rendering a half-broken screen.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `dad3dace` added 2 cases to `balanced-training-play.data.test.ts`; commit `481b0be8` later deleted that file. One hands TUOD a camelCase snapshot seated on the step's own participant. The other checks that the seated snapshot folds into a live TUOD state instead of throwing.

## Pros and Cons of the Options
### Spread the raw step configuration with `seats: []`
* Bad, because `state()` throws on every evaluation and the Finishing step renders no target section.
* Bad, because `config.durationType` reads as `undefined`, so the step's own MINUTES countdown never starts.

### Build the snapshot through `toSnapshot` plus a seated participant
* Good, because the config is validated against the TUOD Zod schema on the way through.
* Good, because the Finishing step runs its own 10-minute countdown.

## Evidence / More Information
Decided: 2026-09-14

* Commit `dad3dace` (2026-09-14; `balanced-training-play.data.ts` and its test): rebuilt Context, Decision Drivers, Considered Options, Confirmation and Pros and Cons.
