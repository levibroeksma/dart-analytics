---
id: D0337
status: superseded
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, state, persist, x-data]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0351
---
<!-- backfill: pending -->

# Routine step reorder is move-up/move-down buttons, not drag; `@alpinejs/sort` declined for now

## Context and Problem Statement
two square buttons reuse Alpine state the factory already owns, with no pointer/touch drag-target logic and no extra accessibility work for a keyboard/screen-reader user, whom a drag handle would otherwise strand. The step list a routine can hold is capped at `MAX_ROUTINE_STEPS` = 12 (`app/src/pages/api/routines/types.ts`), and each step still satisfies D305's 30–60 minute floor pre-checked by the shared `routine-duration.module.ts` before the server's own deferred trigger (migration `0038`, D336) gets the final word — reorder itself never touches duration, so nothing about the floor favoured either mechanism. Against a list this short, drag's speed advantage over at most 11 taps was judged not worth a new dependency.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`RoutineStepRow.astro`'s two `IconBtn`s (`moveUp(index)`/`moveDown(index)` on `routineBuilder()` in `routine-builder.data.ts`, each disabled at the first/last position) reorder a routine's steps in the builder — array-index swaps via `Array.prototype.splice`-style assignment — instead of the `@alpinejs/sort` drag-and-drop dependency `07-Frontend/00-Overview.md` had flagged as a proposed, not-yet-adopted dependency for D306's (refined by D321) Phase 1 write contract. The package is not added to `app/package.json`.".

### Consequences
`@alpinejs/sort` stays a deferred option, not rejected outright — a future UI pass could still adopt it for a longer list or a touch-first redesign; this decision closes only Phase 1's implementation choice, not the door. The move buttons are plain `@click` handlers on the page's own `x-data="routineBuilder(mode)"` scope — no new store, no `$persist`, matching every other builder mutator (`addStep`/`removeStep`/`setMinutes`). `docs/architecture/07-Frontend/00-Overview.md`'s builder paragraph is corrected from "planned"/"proposed dependency" to present tense, shipped.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
