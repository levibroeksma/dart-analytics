---
id: D0236
status: accepted
date: 2026-08-26
origin: contemporaneous
original-date:
tags: [game-engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# TUOD's 1v1 round count is player-configurable, mirroring Score Training's `duration_value` override (D177/D178)

## Context and Problem Statement
Issue #161 reported that 1v1 was hard-locked to exactly 10 rounds with no way to change it, while the notice explaining why timed mode is unavailable added nothing a player could act on. TUOD already forces `durationType` back to ROUNDS once a guest is added (`forceRoundsIfGuested`, unchanged by this decision — timed 1v1 is still out of scope, see `2026-08-22-single-opponent-seat-remaining-engines-design.md`); the round *count* was the only genuinely fixed value left, and the app already has an identical, working mechanism for exactly this (D177/D178) one game over.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`TuodSetupForm.astro`'s 1v1 branch (`guests.length > 0`) replaces the static "1v1 plays 10 Rounds — timed mode is solo-only" notice with a free-typed rounds `Input` (`x-model.number="durationValue"`), matching `ScoreTrainingSetupForm.astro`'s own guested branch exactly. `tuod-setup.data.ts` gains `durationValue`/`clampNotice` state, seeded from the ROUNDS preset's own `duration_value` on `init()`; `start()` clamps a guested session's typed value into a new `clampTuodRounds()` (1–100, `tuod-duration.ts`) and threads it into `createSession`'s `config.overrides.duration_value`, exactly as Score Training's `start()` already does. A solo session is untouched: no override is sent, and the preset's own `duration_value` still applies unmodified.".

### Consequences
`tuod-duration.ts` is a new, separately-tested module (`tuod-duration.test.ts`) rather than a shared helper with `score-training-duration.ts`, since TUOD only ever clamps ROUNDS (1v1 is ROUNDS-only) while Score Training clamps both ROUNDS and MINUTES — a shared module would carry an unused MINUTES branch for TUOD. `npx fallow` flags the resulting `durationValueOf`/clamp-and-override shape as a new clone group across `five-oh-one-setup.data.ts`/`score-training-setup.data.ts`/`tuod-setup.data.ts`; duplication moves from 14.2% to 14.3%, still under the 15% gate (`npx fallow` exits 0). Solo TUOD setup gains no new control — it still only toggles between the two fixed ROUNDS/MINUTES presets, unchanged from before this decision.

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
