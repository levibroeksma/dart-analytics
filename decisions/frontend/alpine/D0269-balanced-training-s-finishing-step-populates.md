---
id: D0269
status: superseded
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, x-data, x-init]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0279
---

# Balanced Training's Finishing step populates the real global `$store.game` rather than forking `TenUpOneDown.astro`/`BoardInputPanel.astro`

## Context and Problem Statement
`docs/superpowers/specs/2026-09-12-balanced-training-playable-design.md` §6 mandates reusing the existing TUOD play UI "in place" rather than building a dedicated in-routine screen, but its own text stopped short of resolving the one real obstacle this creates: `TenUpOneDown.astro`/`BoardInputPanel.astro` read `$store.game` as Alpine's registered global store, not a prop or a locally-scoped object, so nothing short of forking both components could point them at a routine-local copy instead. Populating the real global store costs nothing extra since a player can never have a standalone TUOD game and a Balanced Training routine's Finishing step active at the same time, and `$store.game.reset()` already exists for exactly this kind of handoff.

## Decision Drivers
* The balanced-training spec reuses the existing TUOD play UI in place instead of a dedicated in-routine screen.
* `TenUpOneDown.astro` and `BoardInputPanel.astro` read the global `$store.game`, so props cannot point them at a page-local substitute.

## Considered Options
* Populate the real global `$store.game` for the Finishing step (chosen).
* Fork `TenUpOneDown.astro` and `BoardInputPanel.astro` to accept an injected store.

## Decision Outcome
Chosen option: "`balanced-training-play.data.ts`'s Finishing step reuses the existing standalone TUOD play UI unmodified. Its `startFinishingStep()` helper calls `self.$store.game.reset()` then `self.$store.game.startSession({...})` with the just-created Finishing `exercise_sessions` row's own `sessionId`/`gameTypeKey`/`rulesetVersionKey`/mode pair and a `configSnapshot` built from the step's resolved configuration plus an empty `seats: []`, exactly as a standalone TUOD session would populate it. A new `finishing-step.data.ts` wraps the real `tuodPlay()` unchanged — `finishingStep(onStepComplete)` overrides only `uploadAndCompleteSession()` to call through to TUOD's own implementation and then `onStepComplete()` (the routine's `completeCurrentStep()`), gated by `this.currentStep()?.exerciseTypeKey !== "GAME"` so the routine-level `completeSession()` call does not fire a second, redundant PATCH for a step `tuodPlay()` already completed itself. `play/index.astro` mounts the wrapped store as a nested `x-data="finishing"` inside the routine's own `x-data="balancedTrainingPlay()"` scope; neither scope carries an `x-init` directive — Alpine calls a data factory's own `init()` method automatically once mounted, which is what lets the nested Finishing scope's own `tuodPlay()` reconciliation (`fetchActiveSessions()` + `reconcileActiveSession()`) run with `$store` correctly injected, after `$store.game` has already been populated by the parent's `startFinishingStep()` call.".

### Consequences
the Finishing step's own completion must route through TUOD's unmodified `uploadAndCompleteSession()` rather than the routine's shared `completeSession()` call every other step (Warm-Up, Switching, Double Pattern) uses — `completeCurrentStep()` carries one `exerciseTypeKey !== "GAME"` branch as the one place this asymmetry is visible. Should this repo later ever let one player run two TUOD-shaped sessions concurrently (a standalone game alongside a routine's Finishing step), this decision would need revisiting — no such case exists today. Full design and implementation plan: `docs/superpowers/specs/2026-09-12-balanced-training-playable-design.md`, `docs/superpowers/plans/2026-09-12-balanced-training-playable-implementation.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
If a player can ever run a standalone TUOD game and a routine's Finishing step at the same time. The Consequences of the adding commit name this case.

### Confirmation
The plan's Task 13 starts from a failing test of `finishingStep(onStepComplete)`: `onStepComplete` runs after `tuodPlay()`'s own upload finishes.

## Pros and Cons of the Options
### Populate the real global `$store.game`
* Good, because the plan calls it the additive, minimal choice: it reuses the global store exactly as designed, with `$store.game.startSession(...)`.
* Good, because `$store.game.reset()` already exists for the cleanup a finished step needs.
* Bad, because the Finishing step temporarily "borrows" the global store, which the plan accepts because a player cannot run a standalone TUOD game and a Finishing step at once.

### Fork `TenUpOneDown.astro` and `BoardInputPanel.astro`
* Bad, because the plan treats it as the non-minimal route: both components change to accept an injected store.

## Evidence / More Information
Decided: 2026-09-12

* `docs/superpowers/plans/2026-09-12-balanced-training-playable-implementation.md` (Task 13, Interfaces and the constraint paragraph): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-09-12-balanced-training-playable-design.md` (§ 2 Scope decisions, § 6 Frontend): rebuilt Decision Drivers.
* Commit `4cb9337a` (2026-09-12, adds the D269 row): rebuilt Revisit When from the row's Consequences.
