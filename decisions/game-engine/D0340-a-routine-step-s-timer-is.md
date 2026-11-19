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

# A routine step's timer is the game's own timed-mode clock; routine-eligibility needs agreement between a server table and a client table

## Context and Problem Statement
A separate step-level timer racing the game's own would double-govern one duration from two clocks that could disagree — the game's own timed mode is already the authoritative "did this session end" signal every standalone play screen uses, so a routine step reusing it rather than layering a second clock on top is the only shape with one source of truth. The client cannot import the server table directly: `app/src/lib/` code (the adapter registry) is browser-bundled and `services/**` is Worker-only, so no import path exists between them without breaking that boundary — hand-mirroring plus a test that fails the moment the two lists diverge is the only mechanism available that does not require a shared import.

## Decision Drivers
* A step-level timer would race the game's own timed mode, which is the authoritative signal every standalone play screen uses (spec, § 5.2; row added by commit `38947f7a`).
* A game with no native timed mode would need the adapter to cut a leg mid-flight and mark it `COMPLETED`, which changes what the game's facts mean (spec, § 5.2).
* `app/src/lib/` is browser-bundled and `services/**` is Worker-only, so no import path joins the client and server tables (row added by commit `38947f7a`).

## Considered Options
* A separate step-level clock that cuts the game off (the spec rules this out for games with no native timed mode).
* Write the step duration into the game's own timed-mode keys and let its native expiry end the step (chosen).
* One shared eligibility table imported by both client and server (not possible across the browser/Worker boundary).

## Decision Outcome
Chosen option: "A GAME routine step carries no clock of its own — its duration writes directly into the pinned ruleset's own timed-mode duration keys (`applyStepDuration`), so the game's native expiry ends the step exactly as it would end a standalone session of that game. A ruleset version is routine-eligible only when it has a native timed mode, declares both `ANALYTICS` and `VISUAL_BOARD` in `RULESET_CAPABILITIES`, and is listed in **both** `ROUTINE_GAME_STEPS` (`app/src/services/routines/game-step.ts`, server) and `STEP_ADAPTERS` (`app/src/lib/training/routines/adapters/step-adapter.registry.ts`, client) — currently `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`; `121_V1` (TARGET-only) is excluded for lacking a timed mode. The two tables are hand-mirrored rather than one shared import, and are cross-checked only by `step-adapter.registry.test.ts`, asserting `Object.keys(STEP_ADAPTERS)` (the `GAME:` half) equals `Object.keys(ROUTINE_GAME_STEPS)` one-for-one.".

### Consequences
adding a fourth routine-eligible game is a two-file, two-registry change (`ROUTINE_GAME_STEPS` and `STEP_ADAPTERS`) plus the registry test's own key-set assertion — missing either table fails that test, but nothing stops an agent from editing one file's *entries* to disagree in content (say, the wrong `headerLabel`) while both key sets still match; the test proves the two tables list the same games, not that they agree on everything about each one. `exercise_templates.game_ruleset_version_id` (D339) can technically pin an ineligible ruleset version — the schema has no opinion — so `routineGameStepHook` returning `undefined` at read time, not the foreign key, is what actually refuses it, surfacing as `VALIDATION_FAILED { reason: "game not routine-eligible" }` from both `startTraining` and `routine.service.ts`'s builder-time check.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts` asserts that `Object.keys(STEP_ADAPTERS)` (the `GAME:` half) equals `Object.keys(ROUTINE_GAME_STEPS)`. It proves the two tables list the same games, not that their entries agree.

## Pros and Cons of the Options
### Separate step-level clock
* Bad, because two clocks could disagree about one duration (row added by commit `38947f7a`).
* Bad, because a mid-leg cut changes what the game's facts mean (spec, § 5.2).

### Game's own timed-mode clock
* Good, because it keeps one source of truth for whether the session ended (row added by commit `38947f7a`).
* Bad, because `121_V1`, which has no timed mode, is excluded from routines (same row).

### Shared eligibility table
* Bad, because no import path exists between browser-bundled `app/src/lib/` and Worker-only `services/**` (same row).

## Evidence / More Information
Decided: 2026-09-20

* Commit `38947f7a` (PR #534, 2026-09-20; adds the D340 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/specs/2026-09-18-routine-step-kind-generalisation-design.md` (§ 5.2, § 5.3): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* PR #534 body (Architectural decisions): confirms the registry test as the only cross-check; rebuilt Confirmation.
* `docs/superpowers/plans/2026-09-18-routine-step-kind-generalisation.md`: the plan for the same work; no section rebuilt.
