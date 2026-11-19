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
<!-- backfill: pending -->

# Balanced Training's Finishing step seats TUOD's snapshot on the step's own participant and converts it through `toSnapshot`

## Context and Problem Statement
the routine step's configuration arrives snake_case (`starting_target`, `duration_type`, …) exactly as the seed stores it, while every client snapshot and `TuodSnapshot` is camelCase, and `foldTuodState` maps over `config.seats` and then asks `seat-rota.module.ts`'s `activeSeat` for the active one — with no seats, `pool[facts.turns.length % pool.length]` indexes an empty array and `.participantRef` throws. `state()` therefore threw on every evaluation, and the `x-if` guarding TUOD's target display (`(state()?.seats.length ?? 1) < 2`) threw with it, so the Finishing step rendered the board input panel with no target section at all — the reported symptom. `maybeResumeCountdown` likewise read `config.durationType` as `undefined` and never started the step's own MINUTES countdown. `toSnapshot` is the codec every setup screen already uses for this conversion and validates the config against the ruleset's Zod schema on the way through.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`startFinishingStep()` builds `configSnapshot` as `toSnapshot("TUOD_V1", result.configuration)` plus a one-entry `seats` array carrying the step's own participant (`participantRef` from `result.participant.ref`, `displayName`, `sideKey: "A"`, `participantTypeKey: "PLAYER"`), instead of spreading the raw step configuration with `seats: []`.".

### Consequences
supersedes the `seats: []` half of D269 — the rest of that decision (reusing the unmodified TUOD play UI through the real global `$store.game`) stands unchanged. The Finishing step now runs its own 10-minute countdown, as a standalone TUOD MINUTES session does. A step configuration that fails the TUOD schema now throws inside `startFinishingStep()` and surfaces as the routine's own start error rather than rendering a half-broken screen.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-14
