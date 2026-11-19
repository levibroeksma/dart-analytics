---
id: D0340
status: accepted
date: 2026-09-20
origin: contemporaneous
original-date:
tags: [game-engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A routine step's timer is the game's own timed-mode clock; routine-eligibility needs agreement between a server table and a client table

## Context and Problem Statement
A separate step-level timer racing the game's own would double-govern one duration from two clocks that could disagree — the game's own timed mode is already the authoritative "did this session end" signal every standalone play screen uses, so a routine step reusing it rather than layering a second clock on top is the only shape with one source of truth. The client cannot import the server table directly: `app/src/lib/` code (the adapter registry) is browser-bundled and `services/**` is Worker-only, so no import path exists between them without breaking that boundary — hand-mirroring plus a test that fails the moment the two lists diverge is the only mechanism available that does not require a shared import.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "A GAME routine step carries no clock of its own — its duration writes directly into the pinned ruleset's own timed-mode duration keys (`applyStepDuration`), so the game's native expiry ends the step exactly as it would end a standalone session of that game. A ruleset version is routine-eligible only when it has a native timed mode, declares both `ANALYTICS` and `VISUAL_BOARD` in `RULESET_CAPABILITIES`, and is listed in **both** `ROUTINE_GAME_STEPS` (`app/src/services/routines/game-step.ts`, server) and `STEP_ADAPTERS` (`app/src/lib/training/routines/adapters/step-adapter.registry.ts`, client) — currently `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`; `121_V1` (TARGET-only) is excluded for lacking a timed mode. The two tables are hand-mirrored rather than one shared import, and are cross-checked only by `step-adapter.registry.test.ts`, asserting `Object.keys(STEP_ADAPTERS)` (the `GAME:` half) equals `Object.keys(ROUTINE_GAME_STEPS)` one-for-one.".

### Consequences
adding a fourth routine-eligible game is a two-file, two-registry change (`ROUTINE_GAME_STEPS` and `STEP_ADAPTERS`) plus the registry test's own key-set assertion — missing either table fails that test, but nothing stops an agent from editing one file's *entries* to disagree in content (say, the wrong `headerLabel`) while both key sets still match; the test proves the two tables list the same games, not that they agree on everything about each one. `exercise_templates.game_ruleset_version_id` (D339) can technically pin an ineligible ruleset version — the schema has no opinion — so `routineGameStepHook` returning `undefined` at read time, not the foreign key, is what actually refuses it, surfacing as `VALIDATION_FAILED { reason: "game not routine-eligible" }` from both `startTraining` and `routine.service.ts`'s builder-time check.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-20
