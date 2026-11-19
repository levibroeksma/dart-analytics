---
id: D0380
status: accepted
date: 2026-10-01
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Routine step reorder gains a keyboard path on the drag grip

## Context and Problem Statement
D351 left pointer drag as the only reorder affordance, stranding keyboard and screen-reader users on a meaningful order (D337's own argument). Restoring the move-button pair would undo D351's layout gain; a keyboard handler on the existing handle is additive.

## Decision Drivers
* Keyboard and screen-reader users have no way to reorder steps after D351.
* D351's layout gain should stay.

## Considered Options
* Restore the move-button pair.
* Add a keyboard handler on the existing drag grip.

## Decision Outcome
Chosen option: "`RoutineStepRow.astro`'s grip becomes a focusable `IconBtn` that keeps `x-sort:handle`. ArrowUp/ArrowDown call `routineBuilder().nudgeStep(key, ±1)`, which delegates to `moveStep`, then refocus the grip. `moveStep` sets `moveAnnouncement` (`<name>, position N of M`), rendered in an `aria-live="polite"` `sr-only` paragraph in `RoutineBuilder.astro`. The grip is no longer `aria-hidden`.".

### Consequences
drag reorders are announced too. The key handler refocuses after `$nextTick` because the keyed row is moved in the DOM. No new dependency; `.astro` markup is untested (D101), coverage is `routine-builder.data.test.ts` on `nudgeStep` and `moveAnnouncement`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/training/routines/routine-builder.data.test.ts` covers `nudgeStep` and `moveAnnouncement`; the commit adds 29 lines to it. `.astro` markup is untested (D101).

## Pros and Cons of the Options
### Restore the move buttons
* Bad, because it undoes D351's layout gain.

### Keyboard handler on the grip
* Good, because it is additive: no new dependency and the drag path stays.
* Good, because drag reorders are announced too.
* Bad, because the handler must refocus after `$nextTick`, since the keyed row moves in the DOM.

## Evidence / More Information
Decided: 2026-10-01

* Commit `916f7aaa` (PR #685, 2026-10-01; the `decisions/frontend/alpine.md` row and its diff): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
