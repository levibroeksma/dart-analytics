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

# Routine step reorder is move-up/move-down buttons, not drag; `@alpinejs/sort` declined for now

## Context and Problem Statement
two square buttons reuse Alpine state the factory already owns, with no pointer/touch drag-target logic and no extra accessibility work for a keyboard/screen-reader user, whom a drag handle would otherwise strand. The step list a routine can hold is capped at `MAX_ROUTINE_STEPS` = 12 (`app/src/pages/api/routines/types.ts`), and each step still satisfies D305's 30–60 minute floor pre-checked by the shared `routine-duration.module.ts` before the server's own deferred trigger (migration `0038`, D336) gets the final word — reorder itself never touches duration, so nothing about the floor favoured either mechanism. Against a list this short, drag's speed advantage over at most 11 taps was judged not worth a new dependency. The custom routine builder spec marks the reorder mechanism as a **[decide]** item and recommends move-up and move-down buttons with no new dependency (§ 6.3). The plan's Resolved judgement calls table records that resolution, which the user may overrule before execution.

## Decision Drivers
* Without drag, nothing interacts with the `touch-none` and magnifier rules for board input in `07-Style-Guide.md`, and iOS standalone has no pointer-capture edge cases (spec § 6.3).
* Buttons are keyboard-operable for free (spec § 6.3).
* A 12-step list needs at most 11 taps to move a step anywhere (spec § 6.3).
* Adopting `@alpinejs/sort` later stays one component change and one `package.json` line (spec § 6.3).

## Considered Options
* Move-up and move-down buttons with no new dependency (chosen).
* Drag-and-drop through `@alpinejs/sort`.

Rationale unknown — no source found for any further option.

## Decision Outcome
Chosen option: "`RoutineStepRow.astro`'s two `IconBtn`s (`moveUp(index)`/`moveDown(index)` on `routineBuilder()` in `routine-builder.data.ts`, each disabled at the first/last position) reorder a routine's steps in the builder — array-index swaps via `Array.prototype.splice`-style assignment — instead of the `@alpinejs/sort` drag-and-drop dependency `07-Frontend/00-Overview.md` had flagged as a proposed, not-yet-adopted dependency for D306's (refined by D321) Phase 1 write contract. The package is not added to `app/package.json`.".

### Consequences
`@alpinejs/sort` stays a deferred option, not rejected outright — a future UI pass could still adopt it for a longer list or a touch-first redesign; this decision closes only Phase 1's implementation choice, not the door. The move buttons are plain `@click` handlers on the page's own `x-data="routineBuilder(mode)"` scope — no new store, no `$persist`, matching every other builder mutator (`addStep`/`removeStep`/`setMinutes`). `docs/architecture/07-Frontend/00-Overview.md`'s builder paragraph is corrected from "planned"/"proposed dependency" to present tense, shipped.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found for a compliance check. The plan's Task 8 proposes a builder test that moves steps with `moveDown` and `moveUp` and checks the resulting order.

## Pros and Cons of the Options
### Move-up and move-down buttons
* Good, because they need no new dependency and no pointer or touch drag logic.
* Good, because they are keyboard-operable for free.
* Bad, because moving a step across a 12-step list takes at most 11 taps.

### Drag-and-drop through `@alpinejs/sort`
* Bad, because it needs a new dependency and pointer or touch drag-target logic. The Reason judges its speed advantage over at most 11 taps not worth that cost.

## Evidence / More Information
Decided: 2026-09-19

* `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md` (§ 2 Scope, § 6.3): rebuilt Context, Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-09-18-custom-routine-builder.md` (Resolved judgement calls, Task 8): rebuilt Context and Confirmation.
* Commit `9ffa434c` (2026-09-19; adds the row as D333, renumbered to D337 by commit `75c4924b`): confirmed the Decision Outcome. No section rebuilt.
